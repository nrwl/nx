import {
  BuilderContext,
  BuilderOutput,
  BuilderRun,
  createBuilder,
  targetFromTargetString,
} from '@angular-devkit/architect';
import { executeBrowserBuilder } from '@angular-devkit/build-angular';
import { JsonObject } from '@angular-devkit/core';
import { from, Observable, of } from 'rxjs';
import {
  calculateProjectDependencies,
  checkDependentProjectsHaveBeenBuilt,
  createTmpTsConfig,
} from '@nrwl/workspace/src/utils/buildable-libs-utils';
import { join, normalize } from 'path';
import { createProjectGraph } from '@nrwl/workspace/src/core/project-graph';
import { Schema } from '@angular-devkit/build-angular/src/browser/schema';
import { switchMap } from 'rxjs/operators';
import { existsSync } from 'fs';
import { merge } from 'webpack-merge';

type BrowserBuilderSchema = Schema &
  JsonObject & {
    buildTarget: string;
    customWebpackConfig: {
      path: string;
    };
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
    delegateOptions.customWebpackConfig = undefined;
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

function buildAppWithCustomWebpackConfiguration(
  options: BrowserBuilderSchema,
  context: BuilderContext,
  pathToWebpackConfig: string
) {
  const { buildTarget, customWebpackConfig, ...delegateOptions } = options;

  return executeBrowserBuilder(delegateOptions, context, {
    webpackConfiguration: (baseWebpackConfig) => {
      const customWebpackConfiguration = require(pathToWebpackConfig);
      return merge(baseWebpackConfig, customWebpackConfiguration);
    },
  });
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

  // If we don't have a third-party builder being used
  // And there is a path to custom webpack config
  // Invoke our own support for custom webpack config
  let runBuildWithCustomWebpackConfig = { shouldRun: false, pathToConfig: '' };
  if (
    !options.targetBuilder &&
    options.customWebpackConfig &&
    options.customWebpackConfig.path
  ) {
    const pathToWebpackConfig = normalize(
      join(context.workspaceRoot, options.customWebpackConfig.path)
    );

    if (existsSync(pathToWebpackConfig)) {
      runBuildWithCustomWebpackConfig = {
        shouldRun: true,
        pathToConfig: pathToWebpackConfig,
      };
    }
  }

  return of(checkDependentProjectsHaveBeenBuilt(context, dependencies)).pipe(
    switchMap((result) => {
      if (result) {
        if (runBuildWithCustomWebpackConfig.shouldRun) {
          return buildAppWithCustomWebpackConfiguration(
            options,
            context,
            runBuildWithCustomWebpackConfig.pathToConfig
          );
        } else {
          return from(buildApp(options, context)).pipe(
            switchMap((x) => x.result)
          );
        }
      } else {
        // just pass on the result
        return of({ success: false });
      }
    })
  );
}

export default createBuilder<JsonObject & BrowserBuilderSchema>(run);
