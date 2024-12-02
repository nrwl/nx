import {
  ExecutorContext,
  logger,
  parseTargetString,
  ProjectConfiguration,
  readTargetOptions,
  runExecutor,
  workspaceRoot,
} from '@nx/devkit';
import ssrDevServerExecutor from '@nx/webpack/src/executors/ssr-dev-server/ssr-dev-server.impl';
import { WebSsrDevServerOptions } from '@nx/webpack/src/executors/ssr-dev-server/schema';
import { extname, join } from 'path';
import {
  DevRemoteDefinition,
  startRemoteIterators,
} from '@nx/module-federation/src/executors/utils';
import {
  combineAsyncIterables,
  createAsyncIterable,
} from '@nx/devkit/src/utils/async-iterable';
import { existsSync } from 'fs';
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
  verbose?: boolean;
};
type NormalizedModuleFederationSsrDevServerOptions =
  ModuleFederationSsrDevServerOptions & {
    devRemotes: DevRemoteDefinition[];
    verbose: boolean;
  };

function normalizeOptions(
  options: ModuleFederationSsrDevServerOptions
): NormalizedModuleFederationSsrDevServerOptions {
  return {
    ...options,
    devRemotes: options.devRemotes ?? [],
    verbose: options.verbose ?? false,
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

async function startRemotes(
  remotes: string[],
  workspaceProjects: Record<string, ProjectConfiguration>,
  options: Partial<
    Pick<
      ModuleFederationSsrDevServerOptions,
      'devRemotes' | 'host' | 'ssl' | 'sslCert' | 'sslKey' | 'verbose'
    >
  >,
  context: ExecutorContext
) {
  const remoteIters: AsyncIterable<{ success: boolean }>[] = [];
  const target = 'serve';
  for (const app of remotes) {
    const remoteProjectServeTarget = workspaceProjects[app].targets[target];
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

export default async function* moduleFederationSsrDevServer(
  ssrDevServerOptions: ModuleFederationSsrDevServerOptions,
  context: ExecutorContext
) {
  const options = normalizeOptions(ssrDevServerOptions);
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

  const { staticRemotesIter, devRemoteIters, remotes } =
    await startRemoteIterators(
      options,
      context,
      startRemotes,
      pathToManifestFile,
      'react',
      true
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
