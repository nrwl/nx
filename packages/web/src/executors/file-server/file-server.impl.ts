import { execFileSync, fork } from 'child_process';
import * as chalk from 'chalk';
import {
  ExecutorContext,
  output,
  parseTargetString,
  readTargetOptions,
} from '@nx/devkit';
import { copyFileSync, unlinkSync } from 'fs';
import { Schema } from './schema';
import { platform } from 'os';
import { join, resolve } from 'path';
import { readModulePackageJson } from 'nx/src/utils/package-json';
import * as detectPort from 'detect-port';
import { daemonClient } from 'nx/src/daemon/client/client';
import { interpolate } from 'nx/src/tasks-runner/utils';

// platform specific command name
const pmCmd = platform() === 'win32' ? `npx.cmd` : 'npx';

function getHttpServerArgs(options: Schema) {
  const {
    buildTarget,
    parallel,
    host,
    proxyUrl,
    ssl,
    sslCert,
    sslKey,
    proxyOptions,
    watch,
    spa,
    cacheSeconds,
    ...rest
  } = options;
  const args = [`-c${options.cacheSeconds}`];
  for (const [key, value] of Object.entries(rest)) {
    if (typeof value === 'boolean' && value) {
      args.push(`--${key}`);
    } else if (typeof value === 'string') {
      args.push(`--${key}=${value}`);
    }
  }
  if (host) {
    args.push(`-a=${host}`);
  }
  if (ssl) {
    args.push(`-S`);
  }
  if (sslCert) {
    args.push(`-C=${sslCert}`);
  }
  if (sslKey) {
    args.push(`-K=${sslKey}`);
  }
  if (proxyUrl) {
    args.push(`-P=${proxyUrl}`);
  }
  if (proxyOptions) {
    Object.keys(options.proxyOptions).forEach((key) => {
      args.push(`--proxy-options.${key}=${options.proxyOptions[key]}`);
    });
  }

  return args;
}

function getBuildTargetCommand(options: Schema, context: ExecutorContext) {
  const target = parseTargetString(options.buildTarget, context);
  const cmd = ['nx', 'run'];

  if (target.configuration) {
    cmd.push(`${target.project}:${target.target}:${target.configuration}`);
  } else {
    cmd.push(`${target.project}:${target.target}`);
  }

  if (options.parallel) {
    cmd.push(`--parallel`);
  }
  if (options.maxParallel) {
    cmd.push(`--maxParallel=${options.maxParallel}`);
  }
  return cmd;
}

function getBuildTargetOutputPath(options: Schema, context: ExecutorContext) {
  if (options.staticFilePath) {
    return options.staticFilePath;
  }

  let outputPath: string;
  try {
    const target = parseTargetString(options.buildTarget, context);
    const buildOptions = readTargetOptions(target, context);
    if (buildOptions?.outputPath) {
      outputPath = buildOptions.outputPath;
    } else {
      const project = context.projectGraph.nodes[context.projectName];
      const buildTarget = project.data.targets[target.target];
      outputPath = buildTarget.outputs?.[0];
      if (outputPath)
        outputPath = interpolate(outputPath, {
          projectName: project.data.name,
          projectRoot: project.data.root,
        });
    }
  } catch (e) {
    throw new Error(`Invalid buildTarget: ${options.buildTarget}`);
  }

  if (!outputPath) {
    throw new Error(
      `Unable to get the outputPath from buildTarget ${options.buildTarget}. Make sure ${options.buildTarget} has an outputPath property or manually provide an staticFilePath property`
    );
  }

  return outputPath;
}

function createFileWatcher(
  project: string | undefined,
  changeHandler: () => void
) {
  return daemonClient.registerFileWatcher(
    {
      watchProjects: project ? [project] : 'all',
      includeGlobalWorkspaceFiles: true,
      includeDependentProjects: true,
    },
    async (error, val) => {
      if (error === 'closed') {
        throw new Error('Watch error: Daemon closed the connection');
      } else if (error) {
        throw new Error(`Watch error: ${error?.message ?? 'Unknown'}`);
      } else if (val?.changedFiles.length > 0) {
        changeHandler();
      }
    }
  );
}

export default async function* fileServerExecutor(
  options: Schema,
  context: ExecutorContext
) {
  if (!options.buildTarget && !options.staticFilePath) {
    throw new Error("You must set either 'buildTarget' or 'staticFilePath'.");
  }

  if (options.watch && !options.buildTarget) {
    throw new Error(
      "Watch error: You can only specify 'watch' when 'buildTarget' is set."
    );
  }

  let running = false;
  let disposeWatch: () => void;

  if (options.buildTarget) {
    const run = () => {
      if (!running) {
        running = true;
        /**
         * Expose a variable to the build target to know if it's being run by the serve-static executor
         * This is useful because a config might need to change if it's being run by serve-static without the user's input
         * or if being ran by another executor (eg. E2E tests)
         * */
        process.env.NX_SERVE_STATIC_BUILD_RUNNING = 'true';
        try {
          const args = getBuildTargetCommand(options, context);
          execFileSync(pmCmd, args, {
            stdio: [0, 1, 2],
            shell: true,
            windowsHide: true,
          });
        } catch {
          throw new Error(
            `Build target failed: ${chalk.bold(options.buildTarget)}`
          );
        } finally {
          process.env.NX_SERVE_STATIC_BUILD_RUNNING = undefined;
          running = false;
        }
      }
    };

    if (!daemonClient.enabled() && options.watch) {
      output.warn({
        title:
          'Nx Daemon is not enabled. Static server is not watching for changes.',
      });
    }
    if (daemonClient.enabled() && options.watch) {
      disposeWatch = await createFileWatcher(context.projectName, run);
    }

    // perform initial run
    run();
  }

  const port = await detectPort(options.port || 8080);
  const outputPath = getBuildTargetOutputPath(options, context);

  if (options.spa) {
    const src = join(outputPath, 'index.html');
    const dst = join(outputPath, '404.html');

    // See: https://github.com/http-party/http-server#magic-files
    copyFileSync(src, dst);

    // We also need to ensure the proxyUrl is set, otherwise the browser will continue to throw a 404 error
    // This can cause unexpected behaviors and failures especially in automated test suites
    options.proxyUrl ??= `http${options.ssl ? 's' : ''}://localhost:${port}?`;
  }

  const args = getHttpServerArgs(options);

  const { path: pathToHttpServerPkgJson, packageJson } = readModulePackageJson(
    'http-server',
    module.paths
  );
  const pathToHttpServerBin = packageJson.bin['http-server'];
  const pathToHttpServer = resolve(
    pathToHttpServerPkgJson.replace('package.json', ''),
    pathToHttpServerBin
  );

  // detect port as close to when used to prevent port being used by another process
  // when running in  parallel
  args.push(`-p=${port}`);

  const serve = fork(pathToHttpServer, [outputPath, ...args], {
    stdio: 'pipe',
    cwd: context.root,
    env: {
      FORCE_COLOR: 'true',
      ...process.env,
    },
  });

  const processExitListener = () => {
    serve.kill();
    if (disposeWatch) {
      disposeWatch();
    }

    if (options.spa) {
      unlinkSync(join(outputPath, '404.html'));
    }
  };
  process.on('exit', processExitListener);
  process.on('SIGTERM', processExitListener);

  serve.stdout.on('data', (chunk) => {
    if (chunk.toString().indexOf('GET') === -1) {
      process.stdout.write(chunk);
    }
  });
  serve.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
  });

  yield {
    success: true,
    baseUrl: `${options.ssl ? 'https' : 'http'}://${options.host}:${port}`,
  };

  return new Promise<{ success: boolean }>((res) => {
    serve.on('exit', (code) => {
      if (code == 0) {
        res({ success: true });
      } else {
        res({ success: false });
      }
    });
  });
}
