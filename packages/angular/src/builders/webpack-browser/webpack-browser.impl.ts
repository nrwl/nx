import {
  BuilderContext,
  BuilderOutput,
  createBuilder,
} from '@angular-devkit/architect';
import { executeBrowserBuilder } from '@angular-devkit/build-angular';
import { JsonObject } from '@angular-devkit/core';
import { from, Observable, of } from 'rxjs';
import {
  calculateProjectDependencies,
  checkDependentProjectsHaveBeenBuilt,
  createTmpTsConfig,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { joinPathFragments } from '@nrwl/devkit';
import { join } from 'path';
import { readCachedProjectGraph } from '@nrwl/workspace/src/core/project-graph';
import { Schema } from '@angular-devkit/build-angular/src/browser/schema';
import { switchMap } from 'rxjs/operators';
import { existsSync } from 'fs';
import { merge } from 'webpack-merge';

type BrowserBuilderSchema = Schema & {
  customWebpackConfig?: {
    path: string;
  };
};

function buildApp(
  options: BrowserBuilderSchema,
  context: BuilderContext
): Observable<BuilderOutput> {
  const { customWebpackConfig, ...delegateOptions } = options;
  // If there is a path to custom webpack config
  // Invoke our own support for custom webpack config
  if (customWebpackConfig && customWebpackConfig.path) {
    const pathToWebpackConfig = joinPathFragments(
      context.workspaceRoot,
      customWebpackConfig.path
    );

    if (existsSync(pathToWebpackConfig)) {
      return buildAppWithCustomWebpackConfiguration(
        delegateOptions,
        context,
        pathToWebpackConfig
      );
    } else {
      throw new Error(
        `Custom Webpack Config File Not Found!\nTo use a custom webpack config, please ensure the path to the custom webpack file is correct: \n${pathToWebpackConfig}`
      );
    }
  }

  const scheduledBuilder = context.scheduleBuilder(
    '@angular-devkit/build-angular:browser',
    delegateOptions as Schema & JsonObject,
    {
      target: context.target,
      logger: context.logger as any,
    }
  );

  return from(scheduledBuilder).pipe(switchMap((x) => x.result));
}

function buildAppWithCustomWebpackConfiguration(
  options: Schema,
  context: BuilderContext,
  pathToWebpackConfig: string
) {
  return executeBrowserBuilder(options, context, {
    webpackConfiguration: async (baseWebpackConfig) => {
      const customWebpackConfiguration = require(pathToWebpackConfig);
      // The extra Webpack configuration file can export a synchronous or asynchronous function,
      // for instance: `module.exports = async config => { ... }`.
      if (typeof customWebpackConfiguration === 'function') {
        return customWebpackConfiguration(baseWebpackConfig);
      } else {
        return merge(
          baseWebpackConfig,
          // The extra Webpack configuration file can also export a Promise, for instance:
          // `module.exports = new Promise(...)`. If it exports a single object, but not a Promise,
          // then await will just resolve that object.
          await customWebpackConfiguration
        );
      }
    },
  });
}

function run(
  options: BrowserBuilderSchema,
  context: BuilderContext
): Observable<BuilderOutput> {
  const { target, dependencies } = calculateProjectDependencies(
    readCachedProjectGraph(),
    context.workspaceRoot,
    context.target.project,
    context.target.target,
    context.target.configuration
  );

  options.tsConfig = createTmpTsConfig(
    join(context.workspaceRoot, options.tsConfig),
    context.workspaceRoot,
    target.data.root,
    dependencies
  );
  process.env.NX_TSCONFIG_PATH = options.tsConfig;

  return of(
    checkDependentProjectsHaveBeenBuilt(
      context.workspaceRoot,
      context.target.project,
      context.target.target,
      dependencies
    )
  ).pipe(
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
