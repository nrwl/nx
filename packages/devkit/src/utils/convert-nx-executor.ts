import type { Observable } from 'rxjs';
import type {
  Executor,
  ExecutorContext,
  ProjectsConfigurations,
} from 'nx/src/devkit-exports';

import { NX_VERSION } from './package-json';
import { lt } from 'semver';
import {
  readNxJsonFromDisk,
  readProjectConfigurationsFromRootMap,
  retrieveProjectConfigurationsWithAngularProjects,
} from 'nx/src/devkit-internals';

/**
 * Convert an Nx Executor into an Angular Devkit Builder
 *
 * Use this to expose a compatible Angular Builder
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function convertNxExecutor(executor: Executor) {
  const builderFunction = (options, builderContext) => {
    const nxJsonConfiguration = readNxJsonFromDisk(
      builderContext.workspaceRoot
    );

    const promise = async () => {
      const projectsConfigurations: ProjectsConfigurations = {
        version: 2,
        projects: await retrieveProjectConfigurationsWithAngularProjects(
          builderContext.workspaceRoot,
          nxJsonConfiguration
        ).then((p) => {
          if ((p as any).projectNodes) {
            return (p as any).projectNodes;
          }
          // v18.3.4 changed projects to be keyed by root
          // rather than project name
          if (lt(NX_VERSION, '18.3.4')) {
            return p.projects;
          }

          if (readProjectConfigurationsFromRootMap) {
            return readProjectConfigurationsFromRootMap(p.projects);
          }

          throw new Error(
            'Unable to successfully map Nx executor -> Angular Builder'
          );
        }),
      };

      const context: ExecutorContext = {
        root: builderContext.workspaceRoot,
        projectName: builderContext.target?.project,
        targetName: builderContext.target?.target,
        target: builderContext.target?.target,
        configurationName: builderContext.target?.configuration,
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
