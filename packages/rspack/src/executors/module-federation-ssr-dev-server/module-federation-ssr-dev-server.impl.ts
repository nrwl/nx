import { ExecutorContext, logger } from '@nx/devkit';
import {
  combineAsyncIterables,
  createAsyncIterable,
} from '@nx/devkit/src/utils/async-iterable';
import { getProjectSourceRoot } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { startRemoteIterators } from '@nx/module-federation/src/executors/utils';
import { waitForPortOpen } from '@nx/web/src/utils/wait-for-port-open';
import { existsSync } from 'fs';
import { extname, join } from 'path';
import ssrDevServerExecutor from '../ssr-dev-server/ssr-dev-server.impl';
import { normalizeOptions, startRemotes } from './lib';
import { ModuleFederationSsrDevServerOptions } from './schema';

export default async function* moduleFederationSsrDevServer(
  ssrDevServerOptions: ModuleFederationSsrDevServerOptions,
  context: ExecutorContext
) {
  const options = normalizeOptions(ssrDevServerOptions);

  const iter = ssrDevServerExecutor(options, context);
  const projectConfig =
    context.projectsConfigurations.projects[context.projectName];

  let pathToManifestFile = join(
    context.root,
    getProjectSourceRoot(projectConfig),
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

  return yield* combineAsyncIterables(
    iter,
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
            `Nx failed to start ssr remotes. Check above for errors.`
          );
        } finally {
          done();
        }
      }
    )
  );
}
