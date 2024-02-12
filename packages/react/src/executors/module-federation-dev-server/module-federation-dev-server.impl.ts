import {
  ExecutorContext,
  logger,
  parseTargetString,
  readTargetOptions,
  runExecutor,
  workspaceRoot,
} from '@nx/devkit';
import devServerExecutor from '@nx/webpack/src/executors/dev-server/dev-server.impl';
import fileServerExecutor from '@nx/web/src/executors/file-server/file-server.impl';
import { WebDevServerOptions } from '@nx/webpack/src/executors/dev-server/schema';
import {
  getModuleFederationConfig,
  getRemotes,
} from '@nx/webpack/src/utils/module-federation';
import {
  combineAsyncIterables,
  createAsyncIterable,
} from '@nx/devkit/src/utils/async-iterable';
import { waitForPortOpen } from '@nx/web/src/utils/wait-for-port-open';
import { fork } from 'child_process';
import { basename, dirname, join } from 'path';
import { cpSync } from 'fs';

type ModuleFederationDevServerOptions = WebDevServerOptions & {
  devRemotes?: string[];
  skipRemotes?: string[];
  static?: boolean;
  isInitialHost?: boolean;
  parallel?: number;
  staticRemotesPort?: number;
};

function getBuildOptions(buildTarget: string, context: ExecutorContext) {
  const target = parseTargetString(buildTarget, context);

  const buildOptions = readTargetOptions(target, context);

  return {
    ...buildOptions,
  };
}

function startStaticRemotesFileServer(
  staticRemotesConfig: StaticRemotesConfig,
  context: ExecutorContext,
  options: ModuleFederationDevServerOptions
) {
  let shouldMoveToCommonLocation = false;
  let commonOutputDirectory: string;
  for (const app of staticRemotesConfig.remotes) {
    const remoteBasePath = staticRemotesConfig.config[app].basePath;
    if (!commonOutputDirectory) {
      commonOutputDirectory = remoteBasePath;
    } else if (commonOutputDirectory !== remoteBasePath) {
      shouldMoveToCommonLocation = true;
      break;
    }
  }

  if (shouldMoveToCommonLocation) {
    commonOutputDirectory = join(workspaceRoot, 'tmp/static-remotes');
    for (const app of staticRemotesConfig.remotes) {
      const remoteConfig = staticRemotesConfig.config[app];
      cpSync(
        remoteConfig.outputPath,
        join(commonOutputDirectory, remoteConfig.urlSegment),
        {
          force: true,
          recursive: true,
        }
      );
    }
  }

  const staticRemotesIter = fileServerExecutor(
    {
      cors: true,
      watch: false,
      staticFilePath: commonOutputDirectory,
      parallel: false,
      spa: false,
      withDeps: false,
      host: options.host,
      port: options.staticRemotesPort,
      ssl: options.ssl,
      sslCert: options.sslCert,
      sslKey: options.sslKey,
    },
    context
  );
  return staticRemotesIter;
}

async function startDevRemotes(
  remotes: {
    remotePorts: any[];
    staticRemotes: string[];
    devRemotes: string[];
  },
  context: ExecutorContext
) {
  const devRemoteIters: AsyncIterable<{ success: boolean }>[] = [];

  for (const app of remotes.devRemotes) {
    const remoteProjectServeTarget =
      context.projectGraph.nodes[app].data.targets['serve'];
    const isUsingModuleFederationDevServerExecutor =
      remoteProjectServeTarget.executor.includes(
        'module-federation-dev-server'
      );

    devRemoteIters.push(
      await runExecutor(
        {
          project: app,
          target: 'serve',
          configuration: context.configurationName,
        },
        {
          watch: true,
          ...(isUsingModuleFederationDevServerExecutor
            ? { isInitialHost: false }
            : {}),
        },
        context
      )
    );
  }
  return devRemoteIters;
}

async function buildStaticRemotes(
  staticRemotesConfig: StaticRemotesConfig,
  nxBin,
  context: ExecutorContext,
  options: ModuleFederationDevServerOptions
) {
  if (!staticRemotesConfig.remotes.length) {
    return;
  }
  logger.info(
    `NX Building ${staticRemotesConfig.remotes.length} static remotes...`
  );
  const mappedLocationOfRemotes: Record<string, string> = {};

  for (const app of staticRemotesConfig.remotes) {
    mappedLocationOfRemotes[app] = `http${options.ssl ? 's' : ''}://${
      options.host
    }:${options.staticRemotesPort}/${
      staticRemotesConfig.config[app].urlSegment
    }`;
  }

  process.env.NX_MF_DEV_SERVER_STATIC_REMOTES = JSON.stringify(
    mappedLocationOfRemotes
  );

  await new Promise<void>((res) => {
    const staticProcess = fork(
      nxBin,
      [
        'run-many',
        `--target=build`,
        `--projects=${staticRemotesConfig.remotes.join(',')}`,
        ...(context.configurationName
          ? [`--configuration=${context.configurationName}`]
          : []),
        ...(options.parallel ? [`--parallel=${options.parallel}`] : []),
      ],
      {
        cwd: context.root,
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      }
    );
    staticProcess.stdout.on('data', (data) => {
      const ANSII_CODE_REGEX =
        /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
      const stdoutString = data.toString().replace(ANSII_CODE_REGEX, '');
      if (stdoutString.includes('Successfully ran target build')) {
        staticProcess.stdout.removeAllListeners('data');
        logger.info(
          `NX Built ${staticRemotesConfig.remotes.length} static remotes`
        );
        res();
      }
    });
    staticProcess.stderr.on('data', (data) => logger.info(data.toString()));
    staticProcess.on('exit', (code) => {
      if (code !== 0) {
        throw new Error(`Remote failed to start. See above for errors.`);
      }
    });
    process.on('SIGTERM', () => staticProcess.kill('SIGTERM'));
    process.on('exit', () => staticProcess.kill('SIGTERM'));
  });
}

type StaticRemoteConfig = {
  basePath: string;
  outputPath: string;
  urlSegment: string;
};

type StaticRemotesConfig = {
  remotes: string[];
  config: Record<string, StaticRemoteConfig> | undefined;
};

export function parseStaticRemotesConfig(
  staticRemotes: string[] | undefined,
  context: ExecutorContext
): StaticRemotesConfig {
  if (!staticRemotes?.length) {
    return { remotes: [], config: undefined };
  }

  const config: Record<string, StaticRemoteConfig> = {};
  for (const app of staticRemotes) {
    const outputPath =
      context.projectGraph.nodes[app].data.targets['build'].options.outputPath;
    const basePath = dirname(outputPath);
    const urlSegment = basename(outputPath);
    config[app] = { basePath, outputPath, urlSegment };
  }

  return { remotes: staticRemotes, config };
}

export default async function* moduleFederationDevServer(
  options: ModuleFederationDevServerOptions,
  context: ExecutorContext
): AsyncIterableIterator<{ success: boolean; baseUrl?: string }> {
  const initialStaticRemotesPorts = options.staticRemotesPort;
  options.staticRemotesPort ??= options.port + 1;
  // Force Node to resolve to look for the nx binary that is inside node_modules
  const nxBin = require.resolve('nx/bin/nx');
  const currIter = options.static
    ? fileServerExecutor(
        {
          ...options,
          parallel: false,
          withDeps: false,
          spa: false,
          cors: true,
        },
        context
      )
    : devServerExecutor(options, context);

  const p = context.projectsConfigurations.projects[context.projectName];
  const buildOptions = getBuildOptions(options.buildTarget, context);

  if (!options.isInitialHost) {
    return yield* currIter;
  }

  const moduleFederationConfig = getModuleFederationConfig(
    buildOptions.tsConfig,
    context.root,
    p.root,
    'react'
  );

  const remotes = getRemotes(
    options.devRemotes,
    options.skipRemotes,
    moduleFederationConfig,
    {
      projectName: context.projectName,
      projectGraph: context.projectGraph,
      root: context.root,
    }
  );

  if (remotes.devRemotes.length > 0 && !initialStaticRemotesPorts) {
    options.staticRemotesPort = options.devRemotes.reduce((portToUse, r) => {
      const remotePort =
        context.projectGraph.nodes[r].data.targets['serve'].options.port;
      if (remotePort >= portToUse) {
        return remotePort + 1;
      } else {
        return portToUse;
      }
    }, options.staticRemotesPort);
  }

  const staticRemotesConfig = parseStaticRemotesConfig(
    remotes.staticRemotes,
    context
  );
  await buildStaticRemotes(staticRemotesConfig, nxBin, context, options);

  const devRemoteIters = await startDevRemotes(remotes, context);

  const staticRemotesIter =
    remotes.staticRemotes.length > 0
      ? startStaticRemotesFileServer(staticRemotesConfig, context, options)
      : undefined;

  return yield* combineAsyncIterables(
    currIter,
    ...devRemoteIters,
    ...(staticRemotesIter ? [staticRemotesIter] : []),
    createAsyncIterable<{ success: true; baseUrl: string }>(
      async ({ next, done }) => {
        if (!options.isInitialHost) {
          done();
          return;
        }
        if (remotes.remotePorts.length === 0) {
          done();
          return;
        }
        try {
          const portsToWaitFor = staticRemotesIter
            ? [options.staticRemotesPort, ...remotes.remotePorts]
            : [...remotes.remotePorts];
          await Promise.all(
            portsToWaitFor.map((port) =>
              waitForPortOpen(port, {
                retries: 480,
                retryDelay: 2500,
                host: 'localhost',
              })
            )
          );

          logger.info(
            `NX All remotes started, server ready at http://localhost:${options.port}`
          );
          next({ success: true, baseUrl: `http://localhost:${options.port}` });
        } catch {
          throw new Error(
            `Timed out waiting for remote to start. Check above for any errors.`
          );
        } finally {
          done();
        }
      }
    )
  );
}
