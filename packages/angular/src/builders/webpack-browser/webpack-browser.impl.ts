import {
  BuilderContext,
  BuilderOutput,
  createBuilder,
} from '@angular-devkit/architect';
import { executeBrowserBuilder } from '@angular-devkit/build-angular';
import { Schema } from '@angular-devkit/build-angular/src/builders/browser/schema';
import { JsonObject } from '@angular-devkit/core';
import { joinPathFragments } from '@nrwl/devkit';
import { readCachedProjectGraph } from '@nrwl/workspace/src/core/project-graph';
import {
  calculateProjectDependencies,
  checkDependentProjectsHaveBeenBuilt,
  createTmpTsConfig,
  DependentBuildableProjectNode,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { existsSync } from 'fs';
import { join } from 'path';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { merge } from 'webpack-merge';
import { resolveCustomWebpackConfig } from '../utilities/webpack';

export type BrowserBuilderSchema = Schema & {
  customWebpackConfig?: {
    path: string;
  };
  buildLibsFromSource?: boolean;
};

function buildApp(
  options: BrowserBuilderSchema,
  context: BuilderContext
): Observable<BuilderOutput> {
  const { buildLibsFromSource, customWebpackConfig, ...delegateOptions } =
    options;
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

  return executeBrowserBuilder(delegateOptions, context);
}

function buildAppWithCustomWebpackConfiguration(
  options: Schema,
  context: BuilderContext,
  pathToWebpackConfig: string
) {
  return executeBrowserBuilder(options, context as any, {
    webpackConfiguration: async (baseWebpackConfig) => {
      const customWebpackConfiguration = resolveCustomWebpackConfig(
        pathToWebpackConfig,
        options.tsConfig
      );
      // The extra Webpack configuration file can also export a Promise, for instance:
      // `module.exports = new Promise(...)`. If it exports a single object, but not a Promise,
      // then await will just resolve that object.
      const config = await customWebpackConfiguration;

      // The extra Webpack configuration file can export a synchronous or asynchronous function,
      // for instance: `module.exports = async config => { ... }`.
      if (typeof config === 'function') {
        return customWebpackConfiguration(
          baseWebpackConfig,
          options,
          context.target
        );
      } else {
        return merge(baseWebpackConfig, config);
      }
    },
  });
}

function run(
  options: BrowserBuilderSchema,
  context: BuilderContext
): Observable<BuilderOutput> {
  options.buildLibsFromSource ??= true;
  let dependencies: DependentBuildableProjectNode[];

  if (!options.buildLibsFromSource) {
    const result = calculateProjectDependencies(
      readCachedProjectGraph(),
      context.workspaceRoot,
      context.target.project,
      context.target.target,
      context.target.configuration
    );
    dependencies = result.dependencies;

    options.tsConfig = createTmpTsConfig(
      join(context.workspaceRoot, options.tsConfig),
      context.workspaceRoot,
      result.target.data.root,
      dependencies
    );
  }
  process.env.NX_TSCONFIG_PATH = options.tsConfig;

  return of(
    !options.buildLibsFromSource
      ? checkDependentProjectsHaveBeenBuilt(
          context.workspaceRoot,
          context.target.project,
          context.target.target,
          dependencies
        )
      : true
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

export default createBuilder<JsonObject & BrowserBuilderSchema>(run) as any;
