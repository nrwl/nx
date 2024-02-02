import type { Observable } from 'rxjs';
import type { Executor, ExecutorContext } from 'nx/src/config/misc-interfaces';
import type { ProjectsConfigurations } from 'nx/src/devkit-exports';

import { requireNx } from '../../nx';

const {
  Workspaces,
  readNxJsonFromDisk,
  retrieveProjectConfigurationsWithAngularProjects,
} = requireNx();

/**
 * Convert an Nx Executor into an Angular Devkit Builder
 *
 * Use this to expose a compatible Angular Builder
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function convertNxExecutor(executor: Executor) {
  const builderFunction = (options, builderContext) => {
    const workspaces = new Workspaces(builderContext.workspaceRoot);
    const nxJsonConfiguration = readNxJsonFromDisk
      ? readNxJsonFromDisk(builderContext.workspaceRoot)
      : // TODO(v19): remove readNxJson. This is to be backwards compatible with Nx 16.5 and below.
        (workspaces as any).readNxJson();

    const promise = async () => {
      const projectsConfigurations: ProjectsConfigurations =
        retrieveProjectConfigurationsWithAngularProjects
          ? {
              version: 2,
              projects: await retrieveProjectConfigurationsWithAngularProjects(
                builderContext.workspaceRoot,
                nxJsonConfiguration
              ).then((p) => (p as any).projectNodes ?? p.projects),
            }
          : // TODO(v19): remove retrieveProjectConfigurations. This is to be backwards compatible with Nx 16.5 and below.
            (workspaces as any).readProjectsConfigurations({
              _includeProjectsFromAngularJson: true,
            });

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
