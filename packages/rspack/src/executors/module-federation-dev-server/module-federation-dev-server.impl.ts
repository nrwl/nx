import { ExecutorContext, logger } from '@nx/devkit';
import {
  combineAsyncIterables,
  createAsyncIterable,
} from '@nx/devkit/src/utils/async-iterable';
import { getProjectSourceRoot } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { startRemoteIterators } from '@nx/module-federation/src/executors/utils';
import fileServerExecutor from '@nx/web/src/executors/file-server/file-server.impl';
import { waitForPortOpen } from '@nx/web/src/utils/wait-for-port-open';
import { existsSync } from 'fs';
import { extname, join } from 'path';
import devServerExecutor from '../dev-server/dev-server.impl';
import { normalizeOptions, startRemotes } from './lib';
import { ModuleFederationDevServerOptions } from './schema';

export default async function* moduleFederationDevServer(
  schema: ModuleFederationDevServerOptions,
  context: ExecutorContext
): AsyncIterableIterator<{ success: boolean; baseUrl?: string }> {
  const options = normalizeOptions(schema);
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

  let pathToManifestFile = join(
    context.root,
    getProjectSourceRoot(p),
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

  const { staticRemotesIter, devRemoteIters, remotes } =
    await startRemoteIterators(
      options,
      context,
      startRemotes,
      pathToManifestFile,
      'react'
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
          const portsToWaitFor =
            staticRemotesIter && options.staticRemotesPort
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
            `Failed to start remotes. Check above for any errors.`
          );
        } finally {
          done();
        }
      }
    )
  );
}
