/**
 * This is a copy of the @nx/devkit utility but this should not be used outside of the nx package
 */

import type { Observable } from 'rxjs';
import { readNxJson } from '../../config/nx-json';
import { Executor, ExecutorContext } from '../../config/misc-interfaces';
import { retrieveProjectConfigurations } from '../../project-graph/utils/retrieve-workspace-files';
import { readProjectConfigurationsFromRootMap } from '../../project-graph/utils/project-configuration-utils';
import { ProjectsConfigurations } from '../../config/workspace-json-project-json';
import { loadNxPlugins } from '../../project-graph/plugins/internal-api';

/**
 * Convert an Nx Executor into an Angular Devkit Builder
 *
 * Use this to expose a compatible Angular Builder
 */
export function convertNxExecutor(executor: Executor) {
  const builderFunction = (options, builderContext) => {
    const promise = async () => {
      const nxJsonConfiguration = readNxJson(builderContext.workspaceRoot);

      const [plugins, cleanup] = await loadNxPlugins(
        nxJsonConfiguration.plugins,
        builderContext.workspaceRoot
      );
      const projectsConfigurations: ProjectsConfigurations = {
        version: 2,
        projects: readProjectConfigurationsFromRootMap(
          (
            await retrieveProjectConfigurations(
              plugins,
              builderContext.workspaceRoot,
              nxJsonConfiguration
            )
          ).projects
        ),
      };
      cleanup();
      const context: ExecutorContext = {
        root: builderContext.workspaceRoot,
        projectName: builderContext.target.project,
        targetName: builderContext.target.target,
        target: builderContext.target.target,
        configurationName: builderContext.target.configuration,
        projectsConfigurations,
        nxJsonConfiguration,
        cwd: process.cwd(),
        projectGraph: null,
        taskGraph: null,
        isVerbose: false,
      };
      return executor(options, context);
    };
    return toObservable(promise());
  };
  return require('@angular-devkit/architect').createBuilder(builderFunction);
}

function toObservable<T extends { success: boolean }>(
  promiseOrAsyncIterator: Promise<T | AsyncIterableIterator<T>>
): Observable<T> {
  return new (require('rxjs') as typeof import('rxjs')).Observable(
    (subscriber) => {
      promiseOrAsyncIterator
        .then((value) => {
          if (!(value as any).next) {
            subscriber.next(value as T);
            subscriber.complete();
          } else {
            let asyncIterator = value as AsyncIterableIterator<T>;

            function recurse(iterator: AsyncIterableIterator<T>) {
              iterator
                .next()
                .then((result) => {
                  if (!result.done) {
                    subscriber.next(result.value);
                    recurse(iterator);
                  } else {
                    if (result.value) {
                      subscriber.next(result.value);
                    }
                    subscriber.complete();
                  }
                })
                .catch((e) => {
                  subscriber.error(e);
                });
            }

            recurse(asyncIterator);

            return () => {
              asyncIterator.return();
            };
          }
        })
        .catch((err) => {
          subscriber.error(err);
        });
    }
  );
}
