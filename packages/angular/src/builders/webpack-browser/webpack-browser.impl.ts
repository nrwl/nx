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
import { joinPathFragments } from '@nrwl/devkit';
import { join } from 'path';
import { createProjectGraph } from '@nrwl/workspace/src/core/project-graph';
import { Schema } from '@angular-devkit/build-angular/src/browser/schema';
import { switchMap } from 'rxjs/operators';
import { existsSync } from 'fs';
import { merge } from 'webpack-merge';

type BrowserBuilderSchema = Schema &
  JsonObject & {
    buildTarget?: string;
    customWebpackConfig?: {
      path: string;
    };
  };

function buildApp(
  options: BrowserBuilderSchema,
  context: BuilderContext
): Observable<BuilderOutput> {
  const { buildTarget, ...delegateOptions } = options;

  // If we don't have a third-party builder being used
  // And there is a path to custom webpack config
  // Invoke our own support for custom webpack config
  if (options.customWebpackConfig && options.customWebpackConfig.path) {
    const pathToWebpackConfig = joinPathFragments(
      context.workspaceRoot,
      options.customWebpackConfig.path
    );

    if (existsSync(pathToWebpackConfig)) {
      return buildAppWithCustomWebpackConfiguration(
        options,
        context,
        pathToWebpackConfig
      );
    } else {
      // TODO: Throw bad config error
    }
  }

  let scheduledBuilder: Promise<BuilderRun>;

  if (buildTarget) {
    const target = targetFromTargetString(buildTarget);
    scheduledBuilder = context.scheduleTarget(target, delegateOptions, {
      target: context.target,
      logger: context.logger as any,
    });
  } else {
    delegateOptions.customWebpackConfig = undefined;
    scheduledBuilder = context.scheduleBuilder(
      '@angular-devkit/build-angular:browser',
      delegateOptions,
      {
        target: context.target,
        logger: context.logger as any,
      }
    );
  }

  return from(scheduledBuilder).pipe(switchMap((x) => x.result));
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

  return of(checkDependentProjectsHaveBeenBuilt(context, dependencies)).pipe(
    switchMap((result) => {
      if (result) {
        return buildApp(options, context);
      } else {
        // just pass on the result
        return of({ success: false });
      }
    })
  );
}

export default createBuilder<JsonObject & BrowserBuilderSchema>(run);
