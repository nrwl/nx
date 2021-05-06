import {
  BuilderContext,
  BuilderOutput,
  BuilderRun,
  createBuilder,
  targetFromTargetString,
} from '@angular-devkit/architect';
import { JsonObject } from '@angular-devkit/core';
import { from, Observable, of } from 'rxjs';
import {
  calculateProjectDependencies,
  checkDependentProjectsHaveBeenBuilt,
  createTmpTsConfig,
} from '@nrwl/workspace/src/utils/buildable-libs-utils';
import { join } from 'path';
import { createProjectGraph } from '@nrwl/workspace/src/core/project-graph';
import { Schema } from '@angular-devkit/build-angular/src/browser/schema';
import { switchMap } from 'rxjs/operators';

type BrowserBuilderSchema = Schema &
  JsonObject & {
    buildTarget: string;
  };

function buildApp(
  options: BrowserBuilderSchema,
  context: BuilderContext
): Promise<BuilderRun> {
  const { buildTarget, ...delegateOptions } = options;

  if (buildTarget) {
    const target = targetFromTargetString(buildTarget);
    return context.scheduleTarget(target, delegateOptions, {
      target: context.target,
      logger: context.logger as any,
    });
  } else {
    return context.scheduleBuilder(
      '@angular-devkit/build-angular:browser',
      delegateOptions,
      {
        target: context.target,
        logger: context.logger as any,
      }
    );
  }
}

function run(
  options: BrowserBuilderSchema,
  context: BuilderContext
): Observable<BuilderOutput> {
  const projGraph = createProjectGraph();

  const { target, dependencies } = calculateProjectDependencies(
    projGraph,
    context
  );

  options.tsConfig = createTmpTsConfig(
    join(context.workspaceRoot, options.tsConfig),
    context.workspaceRoot,
    target.data.root,
    dependencies
  );

  return of(checkDependentProjectsHaveBeenBuilt(context, dependencies)).pipe(
    switchMap((result) => {
      if (result) {
        return from(buildApp(options, context)).pipe(
          switchMap((x) => x.result)
        );
      } else {
        // just pass on the result
        return of({ success: false });
      }
    })
  );
}

export default createBuilder<JsonObject & BrowserBuilderSchema>(run);
