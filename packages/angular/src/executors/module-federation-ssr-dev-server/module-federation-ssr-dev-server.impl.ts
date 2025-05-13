import { type ExecutorContext, logger } from '@nx/devkit';
import {
  combineAsyncIterables,
  createAsyncIterable,
  mapAsyncIterable,
} from '@nx/devkit/src/utils/async-iterable';
import { eachValueFrom } from '@nx/devkit/src/utils/rxjs-for-await';
import { startRemoteIterators } from '@nx/module-federation/src/executors/utils';
import { waitForPortOpen } from '@nx/web/src/utils/wait-for-port-open';
import { existsSync } from 'fs';
import { createBuilderContext } from 'nx/src/adapter/ngcli-adapter';
import { readProjectsConfigurationFromProjectGraph } from 'nx/src/project-graph/project-graph';
import { extname, join } from 'path';
import {
  getDynamicMfManifestFile,
  validateDevRemotes,
} from '../../builders/utilities/module-federation';
import { assertBuilderPackageIsInstalled } from '../utilities/builder-package';
import { normalizeOptions } from './lib/normalize-options';
import { startRemotes } from './lib/start-dev-remotes';
import type { Schema } from './schema';

export async function* moduleFederationSsrDevServerExecutor(
  schema: Schema,
  context: ExecutorContext
) {
  const options = normalizeOptions(schema);

  assertBuilderPackageIsInstalled('@angular-devkit/build-angular');
  const { executeSSRDevServerBuilder } = await import(
    '@angular-devkit/build-angular'
  );

  const currIter = eachValueFrom(
    executeSSRDevServerBuilder(
      options,
      await createBuilderContext(
        {
          builderName: '@nx/angular:webpack-server',
          description: 'Build a ssr application',
          optionSchema: require('../../builders/webpack-server/schema.json'),
        },
        context
      )
    )
  );

  if (options.isInitialHost === false) {
    return yield* currIter;
  }

  const { projects: workspaceProjects } =
    readProjectsConfigurationFromProjectGraph(context.projectGraph);
  const project = workspaceProjects[context.projectName];

  let pathToManifestFile: string;
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
  } else {
    pathToManifestFile = getDynamicMfManifestFile(project, context.root);
  }

  validateDevRemotes({ devRemotes: options.devRemotes }, workspaceProjects);

  const { remotes, staticRemotesIter, devRemoteIters } =
    await startRemoteIterators(
      options,
      context,
      startRemotes,
      pathToManifestFile,
      'angular',
      true
    );

  const removeBaseUrlEmission = (iter: AsyncIterable<unknown>) =>
    mapAsyncIterable(iter, (v) => ({
      ...v,
      baseUrl: undefined,
    }));

  const combined = combineAsyncIterables(
    removeBaseUrlEmission(staticRemotesIter),
    ...(devRemoteIters ? devRemoteIters.map(removeBaseUrlEmission) : []),
    createAsyncIterable<{ success: true; baseUrl: string }>(
      async ({ next, done }) => {
        if (!options.isInitialHost) {
          done();
          return;
        }
        if (remotes.remotePorts.length) {
          logger.info(
            `Nx All remotes started, server ready at http://localhost:${options.port}`
          );

          next({ success: true, baseUrl: `http://localhost:${options.port}` });
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
          next({ success: true, baseUrl: `http://localhost:${options.port}` });
        } catch (error) {
          throw new Error(
            `Failed to start remotes. Check above for any errors.`,
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
  let refs = 2 + (devRemoteIters?.length ?? 0);
  for await (const result of combined) {
    if (result.success === false) throw new Error('Remotes failed to start');
    if (result.success) refs--;
    if (refs === 0) break;
  }

  return yield* currIter;
}

export default moduleFederationSsrDevServerExecutor;
