import { BuilderContext, createBuilder } from '@angular-devkit/architect';
import { JsonObject } from '@angular-devkit/core';
import { joinPathFragments, readCachedProjectGraph } from '@nrwl/devkit';
import {
  calculateProjectDependencies,
  createTmpTsConfig,
  DependentBuildableProjectNode,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { existsSync } from 'fs';
import { join } from 'path';
import { Observable } from 'rxjs';
import { merge } from 'webpack-merge';
import { resolveCustomWebpackConfig } from '../utilities/webpack';
import {
  executeServerBuilder,
  ServerBuilderOutput,
} from '@angular-devkit/build-angular';
import { Schema } from './schema';

function buildServerApp(
  options: Schema,
  context: BuilderContext
): Observable<ServerBuilderOutput> {
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
      return buildServerAppWithCustomWebpackConfiguration(
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

  return executeServerBuilder(delegateOptions, context);
}

function buildServerAppWithCustomWebpackConfiguration(
  options: Schema,
  context: BuilderContext,
  pathToWebpackConfig: string
) {
  return executeServerBuilder(options, context as any, {
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
        return config(baseWebpackConfig, options, context.target);
      } else {
        return merge(baseWebpackConfig, config);
      }
    },
  });
}

export function executeWebpackServerBuilder(
  options: Schema,
  context: BuilderContext
): Observable<ServerBuilderOutput> {
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
    process.env.NX_TSCONFIG_PATH = options.tsConfig;
  }

  return buildServerApp(options, context);
}

export default createBuilder<JsonObject & Schema>(
  executeWebpackServerBuilder
) as any;
