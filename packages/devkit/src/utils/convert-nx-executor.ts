import { from } from 'rxjs';
import { map } from 'rxjs/operators';

import {
  Executor,
  ExecutorContext,
  Workspaces,
} from '@nrwl/tao/src/shared/workspace';
import { BuilderContext } from '@angular-devkit/architect';

/**
 * Convert an Nx Executor into an Angular Devkit Builder
 *
 * Use this to expose a compatible Angular Builder
 */
export function convertNxExecutor(executor: Executor) {
  const builderFunction = (options, builderContext: BuilderContext) => {
    const workspaceConfig = new Workspaces(
      builderContext.workspaceRoot
    ).readWorkspaceConfiguration();
    const context: ExecutorContext = {
      root: builderContext.workspaceRoot,
      projectName: builderContext.target.project,
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
    return from(toPromise(executor(options, context))).pipe(
      map((output) => {
        if (!output) {
          return {
            success: true,
          };
        } else {
          return {
            ...output,
            success: true,
          };
        }
      })
    );
  };
  return require('@angular-devkit/architect').createBuilder(builderFunction);
}

async function toPromise(promiseOrAsyncIterator: any): Promise<any> {
  if (typeof promiseOrAsyncIterator.then === 'function')
    return promiseOrAsyncIterator;
  let q;
  for await (q of promiseOrAsyncIterator) {
  }
  return q;
}
