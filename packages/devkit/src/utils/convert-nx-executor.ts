import { from } from 'rxjs';
import { map } from 'rxjs/operators';

import { Executor, Workspaces } from '@nrwl/tao/src/shared/workspace';
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
    const context = {
      root: builderContext.workspaceRoot,
      projectName: builderContext.target.project,
      target:
        workspaceConfig.projects[builderContext.target.project].targets[
          builderContext.target.target
        ],
      workspace: workspaceConfig,
    };
    return from(executor(options, context)).pipe(
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
