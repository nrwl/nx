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
import { ModuleFederationDevServerOptions } from './schema';
import {
  getModuleFederationConfig,
  getRemotes,
} from '@nx/webpack/src/utils/module-federation';
import {
  combineAsyncIterables,
  createAsyncIterable,
} from '@nx/devkit/src/utils/async-iterable';
import { waitForPortOpen } from '@nx/web/src/utils/wait-for-port-open';
import { cpSync, existsSync } from 'fs';
import { extname, join } from 'path';
import { startRemoteProxies } from '@nx/webpack/src/utils/module-federation/start-remote-proxies';
import {
  parseStaticRemotesConfig,
  type StaticRemotesConfig,
} from '@nx/webpack/src/utils/module-federation/parse-static-remotes-config';
import { buildStaticRemotes } from '../../utils/build-static.remotes';

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
  if (
    !staticRemotesConfig.remotes ||
    staticRemotesConfig.remotes.length === 0
  ) {
    return;
  }
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
      cacheSeconds: -1,
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

export default async function* moduleFederationDevServer(
  options: ModuleFederationDevServerOptions,
  context: ExecutorContext
): AsyncIterableIterator<{ success: boolean; baseUrl?: string }> {
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
          cacheSeconds: -1,
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
  options.staticRemotesPort ??= remotes.staticRemotePort;

  // Set NX_MF_DEV_REMOTES for the Nx Runtime Library Control Plugin
  process.env.NX_MF_DEV_REMOTES = JSON.stringify([
    ...(remotes.devRemotes.map((r) =>
      typeof r === 'string' ? r : r.remoteName
    ) ?? []),
    p.name,
  ]);

  const staticRemotesConfig = parseStaticRemotesConfig(
    [...remotes.staticRemotes, ...remotes.dynamicRemotes],
    context
  );
  const mappedLocationsOfStaticRemotes = await buildStaticRemotes(
    staticRemotesConfig,
    nxBin,
    context,
    options
  );

  const devRemoteIters = await startRemotes(
    remotes.devRemotes,
    context,
    options,
    'serve'
  );

  const staticRemotesIter = startStaticRemotesFileServer(
    staticRemotesConfig,
    context,
    options
  );

  startRemoteProxies(
    staticRemotesConfig,
    mappedLocationsOfStaticRemotes,
    options.ssl
      ? {
          pathToCert: join(workspaceRoot, options.sslCert),
          pathToKey: join(workspaceRoot, options.sslKey),
        }
      : undefined
  );

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
