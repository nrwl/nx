import {
  BuilderContext,
  BuilderOutput,
  createBuilder,
} from '@angular-devkit/architect';
import { JsonObject } from '@angular-devkit/core';
import { joinPathFragments, parseTargetString } from '@nrwl/devkit';
import { createProjectGraph } from '@nrwl/workspace/src/core/project-graph';
import {
  calculateProjectDependencies,
  checkDependentProjectsHaveBeenBuilt,
  createTmpTsConfig,
} from '@nrwl/workspace/src/utils/buildable-libs-utils';
import { from, Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { DelegateBuildExecutorSchema } from './schema';

function run(
  options: DelegateBuildExecutorSchema,
  context: BuilderContext
): Observable<BuilderOutput> {
  const projGraph = createProjectGraph();

  const { target, dependencies } = calculateProjectDependencies(
    projGraph,
    context
  );

  options.tsConfig = createTmpTsConfig(
    joinPathFragments(context.workspaceRoot, options.tsConfig),
    context.workspaceRoot,
    target.data.root,
    dependencies
  );

  return of(checkDependentProjectsHaveBeenBuilt(context, dependencies)).pipe(
    switchMap((result) => {
      if (result) {
        return from(scheduleDelegateTarget(options, context)).pipe(
          switchMap((x) => x.result)
        );
      }

      return of({ success: false });
    })
  );
}

function scheduleDelegateTarget(
  options: DelegateBuildExecutorSchema,
  context: BuilderContext
) {
  const { buildTarget, ...targetOptions } = options;
  const delegateTarget = parseTargetString(buildTarget);

  return context.scheduleTarget(
    delegateTarget,
    targetOptions as DelegateBuildExecutorSchema & JsonObject,
    {
      target: context.target,
      logger: context.logger as any,
    }
  );
}

export default createBuilder<DelegateBuildExecutorSchema>(run);
