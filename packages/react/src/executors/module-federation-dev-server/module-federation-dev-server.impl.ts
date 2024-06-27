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
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { fork } from 'node:child_process';
import { basename, dirname, join } from 'node:path';
import { createWriteStream, cpSync } from 'node:fs';
import { existsSync } from 'fs';
import { extname } from 'path';

type ModuleFederationDevServerOptions = WebDevServerOptions & {
  devRemotes?: (
    | string
    | {
        remoteName: string;
        configuration: string;
      }
  )[];
  skipRemotes?: string[];
  static?: boolean;
  isInitialHost?: boolean;
  parallel?: number;
  staticRemotesPort?: number;
  pathToManifestFile?: string;
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

async function startRemotes(
  remotes: string[],
  context: ExecutorContext,
  options: ModuleFederationDevServerOptions,
  target: 'serve' | 'serve-static' = 'serve'
) {
  const remoteIters: AsyncIterable<{ success: boolean }>[] = [];

  for (const app of remotes) {
    const remoteProjectServeTarget =
      context.projectGraph.nodes[app].data.targets[target];
    const isUsingModuleFederationDevServerExecutor =
      remoteProjectServeTarget.executor.includes(
        'module-federation-dev-server'
      );

    const configurationOverride = options.devRemotes?.find(
      (
        r
      ): r is {
        remoteName: string;
        configuration: string;
      } => typeof r !== 'string' && r.remoteName === app
    )?.configuration;

    const defaultOverrides = {
      ...(options.host ? { host: options.host } : {}),
      ...(options.ssl ? { ssl: options.ssl } : {}),
      ...(options.sslCert ? { sslCert: options.sslCert } : {}),
      ...(options.sslKey ? { sslKey: options.sslKey } : {}),
    };
    const overrides =
      target === 'serve'
        ? {
            watch: true,
            ...(isUsingModuleFederationDevServerExecutor
              ? { isInitialHost: false }
              : {}),
            ...defaultOverrides,
          }
        : { ...defaultOverrides };

    remoteIters.push(
      await runExecutor(
        {
          project: app,
          target,
          configuration: configurationOverride ?? context.configurationName,
        },
        overrides,
        context
      )
    );
  }
  return remoteIters;
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

    // File to debug build failures e.g. 2024-01-01T00_00_0_0Z-build.log'
    const remoteBuildLogFile = join(
      workspaceDataDirectory,
      `${new Date().toISOString().replace(/[:\.]/g, '_')}-build.log`
    );
    const stdoutStream = createWriteStream(remoteBuildLogFile);

    staticProcess.stdout.on('data', (data) => {
      const ANSII_CODE_REGEX =
        /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
      const stdoutString = data.toString().replace(ANSII_CODE_REGEX, '');
      stdoutStream.write(stdoutString);
      if (stdoutString.includes('Successfully ran target build')) {
        staticProcess.stdout.removeAllListeners('data');
        logger.info(
          `NX Built ${staticRemotesConfig.remotes.length} static remotes`
        );
        res();
      }
    });
    staticProcess.stderr.on('data', (data) => logger.info(data.toString()));
    staticProcess.once('exit', (code) => {
      stdoutStream.end();
      staticProcess.stdout.removeAllListeners('data');
      staticProcess.stderr.removeAllListeners('data');
      if (code !== 0) {
        throw new Error(
          `Remote failed to start. A complete log can be found in: ${remoteBuildLogFile}`
        );
      }
      res();
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

  let pathToManifestFile = join(
    context.root,
    p.sourceRoot,
    'assets/module-federation.manifest.json'
  );
  if (options.pathToManifestFile) {
    const userPathToManifestFile = join(
      context.root,
      options.pathToManifestFile
    );
    if (!existsSync(userPathToManifestFile)) {
      throw new Error(
        `The provided Module Federation manifest file path does not exist. Please check the file exists at "${userPathToManifestFile}".`
      );
    } else if (extname(options.pathToManifestFile) !== '.json') {
      throw new Error(
        `The Module Federation manifest file must be a JSON. Please ensure the file at ${userPathToManifestFile} is a JSON.`
      );
    }

    pathToManifestFile = userPathToManifestFile;
  }

  if (!options.isInitialHost) {
    return yield* currIter;
  }

  const moduleFederationConfig = getModuleFederationConfig(
    buildOptions.tsConfig,
    context.root,
    p.root,
    'react'
  );

  const remoteNames = options.devRemotes?.map((r) =>
    typeof r === 'string' ? r : r.remoteName
  );

  const remotes = getRemotes(
    remoteNames,
    options.skipRemotes,
    moduleFederationConfig,
    {
      projectName: context.projectName,
      projectGraph: context.projectGraph,
      root: context.root,
    },
    pathToManifestFile
  );

  if (remotes.devRemotes.length > 0 && !initialStaticRemotesPorts) {
    options.staticRemotesPort = options.devRemotes.reduce((portToUse, r) => {
      const remoteName = typeof r === 'string' ? r : r.remoteName;
      const remotePort =
        context.projectGraph.nodes[remoteName].data.targets['serve'].options
          .port;
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

  const devRemoteIters = await startRemotes(
    remotes.devRemotes,
    context,
    options,
    'serve'
  );
  const dynamicRemotesIters = await startRemotes(
    remotes.dynamicRemotes,
    context,
    options,
    'serve-static'
  );

  const staticRemotesIter =
    remotes.staticRemotes.length > 0
      ? startStaticRemotesFileServer(staticRemotesConfig, context, options)
      : undefined;

  return yield* combineAsyncIterables(
    currIter,
    ...devRemoteIters,
    ...dynamicRemotesIters,
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
          const host = options.host ?? 'localhost';
          const baseUrl = `http${options.ssl ? 's' : ''}://${host}:${
            options.port
          }`;
          const portsToWaitFor = staticRemotesIter
            ? [options.staticRemotesPort, ...remotes.remotePorts]
            : [...remotes.remotePorts];
          await Promise.all(
            portsToWaitFor.map((port) =>
              waitForPortOpen(port, {
                retries: 480,
                retryDelay: 2500,
                host: host,
              })
            )
          );

          logger.info(`NX All remotes started, server ready at ${baseUrl}`);
          next({ success: true, baseUrl: baseUrl });
        } catch (err) {
          throw new Error(
            `Failed to start remotes. Check above for any errors.`,
            {
              cause: err,
            }
          );
        } finally {
          done();
        }
      }
    )
  );
}
