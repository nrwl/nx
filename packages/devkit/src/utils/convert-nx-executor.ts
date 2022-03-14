import type { Observable } from 'rxjs';
import type { Executor, ExecutorContext } from 'nx/src/shared/workspace';
import { Workspaces } from 'nx/src/shared/workspace';

/**
 * Convert an Nx Executor into an Angular Devkit Builder
 *
 * Use this to expose a compatible Angular Builder
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function convertNxExecutor(executor: Executor) {
  const builderFunction = (options, builderContext) => {
    const workspaces = new Workspaces(builderContext.workspaceRoot);
    const workspaceConfig = workspaces.readWorkspaceConfiguration();
    const context: ExecutorContext = {
      root: builderContext.workspaceRoot,
      projectName: builderContext.target.project,
      targetName: builderContext.target.target,
      configurationName: builderContext.target.configuration,
      workspace: workspaceConfig,
      cwd: process.cwd(),
      isVerbose: false,
    };
    if (
      builderContext.target &&
      builderContext.target.project &&
      builderContext.target.target
    ) {
      context.target =
        workspaceConfig.projects[builderContext.target.project].targets[
          builderContext.target.target
        ];
    }
    return toObservable(executor(options, context));
  };
  return require('@angular-devkit/architect').createBuilder(builderFunction);
}

function toObservable<T extends { success: boolean }>(
  promiseOrAsyncIterator: Promise<T> | AsyncIterableIterator<T>
): Observable<T> {
  if (typeof (promiseOrAsyncIterator as any).then === 'function') {
    return require('rxjs').from(promiseOrAsyncIterator as Promise<T>);
  } else {
    return new (require('rxjs').Observable)((subscriber) => {
      let asyncIterator = promiseOrAsyncIterator as AsyncIterableIterator<T>;

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
    });
  }
}
