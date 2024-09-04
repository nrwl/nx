import {
  ExecutorContext,
  logger,
  parseTargetString,
  readTargetOptions,
  runExecutor,
  workspaceRoot,
} from '@nx/devkit';
import ssrDevServerExecutor from '@nx/webpack/src/executors/ssr-dev-server/ssr-dev-server.impl';
import { WebSsrDevServerOptions } from '@nx/webpack/src/executors/ssr-dev-server/schema';
import { extname, join } from 'path';
import {
  getModuleFederationConfig,
  getRemotes,
} from '@nx/webpack/src/utils/module-federation';

import {
  combineAsyncIterables,
  createAsyncIterable,
} from '@nx/devkit/src/utils/async-iterable';
import { fork } from 'child_process';
import { cpSync, createWriteStream, existsSync } from 'fs';

import {
  parseStaticSsrRemotesConfig,
  type StaticRemotesConfig,
} from '@nx/webpack/src/utils/module-federation/parse-static-remotes-config';

import fileServerExecutor from '@nx/web/src/executors/file-server/file-server.impl';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { startSsrRemoteProxies } from '@nx/webpack/src/utils/module-federation/start-ssr-remote-proxies';
import { waitForPortOpen } from '@nx/web/src/utils/wait-for-port-open';

type ModuleFederationSsrDevServerOptions = WebSsrDevServerOptions & {
  devRemotes?: (
    | string
    | {
        remoteName: string;
        configuration: string;
      }
  )[];

  skipRemotes?: string[];
  host: string;
  pathToManifestFile?: string;
  staticRemotesPort?: number;
  parallel?: number;
  ssl?: boolean;
  sslKey?: string;
  sslCert?: string;
  isInitialHost?: boolean;
};

function normalizeOptions(
  options: ModuleFederationSsrDevServerOptions
): ModuleFederationSsrDevServerOptions {
  return {
    ...options,
    ssl: options.ssl ?? false,
    sslCert: options.sslCert ? join(workspaceRoot, options.sslCert) : undefined,
    sslKey: options.sslKey ? join(workspaceRoot, options.sslKey) : undefined,
  };
}

function getBuildOptions(buildTarget: string, context: ExecutorContext) {
  const target = parseTargetString(buildTarget, context);

  const buildOptions = readTargetOptions(target, context);

  return {
    ...buildOptions,
  };
}

async function* startSsrStaticRemotesFileServer(
  ssrStaticRemotesConfig: StaticRemotesConfig,
  context: ExecutorContext,
  options: ModuleFederationSsrDevServerOptions
):
  | AsyncGenerator<{ success: boolean; baseUrl?: string }>
  | AsyncIterable<{ success: boolean; baseUrl?: string }> {
  if (ssrStaticRemotesConfig.remotes.length === 0) {
    yield { success: true };
    return;
  }

  // The directories are usually generated with /browser and /server suffixes so we need to copy them to a common directory
  const commonOutputDirectory = join(workspaceRoot, 'tmp/static-remotes');
  for (const app of ssrStaticRemotesConfig.remotes) {
    const remoteConfig = ssrStaticRemotesConfig.config[app];

    cpSync(
      remoteConfig.outputPath,
      join(commonOutputDirectory, remoteConfig.urlSegment),
      {
        force: true,
        recursive: true,
      }
    );
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

  yield* staticRemotesIter;
}

async function startRemotes(
  remotes: string[],
  context: ExecutorContext,
  options: ModuleFederationSsrDevServerOptions
) {
  const remoteIters: AsyncIterable<{ success: boolean }>[] = [];
  const target = 'serve';
  for (const app of remotes) {
    const remoteProjectServeTarget =
      context.projectGraph.nodes[app].data.targets[target];
    const isUsingModuleFederationSsrDevServerExecutor =
      remoteProjectServeTarget.executor.includes(
        'module-federation-ssr-dev-server'
      );

    const configurationOverride = options.devRemotes?.find(
      (remote): remote is { remoteName: string; configuration: string } =>
        typeof remote !== 'string' && remote.remoteName === app
    )?.configuration;
    {
      const defaultOverrides = {
        ...(options.host ? { host: options.host } : {}),
        ...(options.ssl ? { ssl: options.ssl } : {}),
        ...(options.sslCert ? { sslCert: options.sslCert } : {}),
        ...(options.sslKey ? { sslKey: options.sslKey } : {}),
      };

      const overrides = {
        watch: true,
        ...defaultOverrides,
        ...(isUsingModuleFederationSsrDevServerExecutor
          ? { isInitialHost: false }
          : {}),
      };

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
  }
  return remoteIters;
}

async function buildSsrStaticRemotes(
  staticRemotesConfig: StaticRemotesConfig,
  nxBin,
  context: ExecutorContext,
  options: ModuleFederationSsrDevServerOptions
) {
  if (!staticRemotesConfig.remotes.length) {
    return;
  }

  logger.info(
    `Nx is building ${staticRemotesConfig.remotes.length} static remotes...`
  );
  const mapLocationOfRemotes: Record<string, string> = {};

  for (const remoteApp of staticRemotesConfig.remotes) {
    mapLocationOfRemotes[remoteApp] = `http${options.ssl ? 's' : ''}://${
      options.host
    }:${options.staticRemotesPort}/${
      staticRemotesConfig.config[remoteApp].urlSegment
    }`;
  }

  await new Promise<void>((resolve) => {
    const childProcess = fork(
      nxBin,
      [
        'run-many',
        '--target=server',
        '--projects',
        staticRemotesConfig.remotes.join(','),
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

    // Add a listener to the child process to capture the build log
    const remoteBuildLogFile = join(
      workspaceDataDirectory,
      `${new Date().toISOString().replace(/[:\.]/g, '_')}-build.log`
    );

    const remoteBuildLogStream = createWriteStream(remoteBuildLogFile);

    childProcess.stdout.on('data', (data) => {
      const ANSII_CODE_REGEX =
        /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
      const stdoutString = data.toString().replace(ANSII_CODE_REGEX, '');
      remoteBuildLogStream.write(stdoutString);

      // in addition to writing into the stdout stream, also show error directly in console
      // so the error is easily discoverable. 'ERROR in' is the key word to search in webpack output.
      if (stdoutString.includes('ERROR in')) {
        logger.log(stdoutString);
      }

      if (stdoutString.includes('Successfully ran target server')) {
        childProcess.stdout.removeAllListeners('data');
        logger.info(
          `Nx Built ${staticRemotesConfig.remotes.length} static remotes.`
        );
        resolve();
      }
    });

    process.on('SIGTERM', () => childProcess.kill('SIGTERM'));
    process.on('exit', () => childProcess.kill('SIGTERM'));
  });
  return mapLocationOfRemotes;
}

export default async function* moduleFederationSsrDevServer(
  ssrDevServerOptions: ModuleFederationSsrDevServerOptions,
  context: ExecutorContext
) {
  const options = normalizeOptions(ssrDevServerOptions);
  // Force Node to resolve to look for the nx binary that is inside node_modules
  const nxBin = require.resolve('nx/bin/nx');
  let iter: any = ssrDevServerExecutor(options, context);
  const projectConfig =
    context.projectsConfigurations.projects[context.projectName];
  const buildOptions = getBuildOptions(options.browserTarget, context);

  let pathToManifestFile = join(
    context.root,
    projectConfig.sourceRoot,
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
    } else if (extname(userPathToManifestFile) !== '.json') {
      throw new Error(
        `The Module Federation manifest file must be a JSON. Please ensure the file at ${userPathToManifestFile} is a JSON.`
      );
    }
    pathToManifestFile = userPathToManifestFile;
  }

  if (!options.isInitialHost) {
    return yield* iter;
  }

  const moduleFederationConfig = getModuleFederationConfig(
    buildOptions.tsConfig,
    context.root,
    projectConfig.root,
    'react'
  );

  const remoteNames = options.devRemotes?.map((remote) =>
    typeof remote === 'string' ? remote : remote.remoteName
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

  process.env.NX_MF_DEV_REMOTES = JSON.stringify([
    ...(remotes.devRemotes.map((r) =>
      typeof r === 'string' ? r : r.remoteName
    ) ?? []),
    projectConfig.name,
  ]);

  const staticRemotesConfig = parseStaticSsrRemotesConfig(
    [...remotes.staticRemotes, ...remotes.dynamicRemotes],
    context
  );

  const mappedLocationsOfStaticRemotes = await buildSsrStaticRemotes(
    staticRemotesConfig,
    nxBin,
    context,
    options
  );

  const devRemoteIters = await startRemotes(
    remotes.devRemotes,
    context,
    options
  );

  const staticRemotesIter = startSsrStaticRemotesFileServer(
    staticRemotesConfig,
    context,
    options
  );

  startSsrRemoteProxies(
    staticRemotesConfig,
    mappedLocationsOfStaticRemotes,
    options.ssl
      ? {
          pathToCert: options.sslCert,
          pathToKey: options.sslKey,
        }
      : undefined
  );

  const combined = combineAsyncIterables(staticRemotesIter, ...devRemoteIters);

  let refs = 1 + (devRemoteIters?.length ?? 0);
  for await (const result of combined) {
    if (result.success === false) throw new Error('Remotes failed to start');
    if (result.success) refs--;
    if (refs === 0) break;
  }

  return yield* combineAsyncIterables(
    iter,
    createAsyncIterable<{ success: true; baseUrl: string }>(
      async ({ next, done }) => {
        const host = options.host ?? 'localhost';
        const baseUrl = `http${options.ssl ? 's' : ''}://${host}:${
          options.port
        }`;
        if (!options.isInitialHost) {
          next({ success: true, baseUrl });
          done();
          return;
        }

        if (remotes.remotePorts.length === 0) {
          next({ success: true, baseUrl });
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
                host,
              })
            )
          );

          logger.info(
            `Nx all ssr remotes have started, server ready at ${baseUrl}`
          );
          next({ success: true, baseUrl });
        } catch (error) {
          throw new Error(
            `Nx failed to start ssr remotes. Check above for errors.`,
            {
              cause: error,
            }
          );
        } finally {
          done();
        }
      }
    )
  );
}
