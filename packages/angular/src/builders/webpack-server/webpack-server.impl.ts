import { BuilderContext, createBuilder } from '@angular-devkit/architect';
import { JsonObject } from '@angular-devkit/core';
import { joinPathFragments } from '@nrwl/devkit';
import { existsSync } from 'fs';
import { Observable } from 'rxjs';
import { mergeCustomWebpackConfig } from '../utilities/webpack';
import {
  executeServerBuilder,
  ServerBuilderOutput,
} from '@angular-devkit/build-angular';
import { Schema } from './schema';
import { createTmpTsConfigForBuildableLibs } from '../utilities/buildable-libs';

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
    webpackConfiguration: (baseWebpackConfig) =>
      mergeCustomWebpackConfig(
        baseWebpackConfig,
        pathToWebpackConfig,
        options,
        context.target
      ),
  });
}

export function executeWebpackServerBuilder(
  options: Schema,
  context: BuilderContext
): Observable<ServerBuilderOutput> {
  options.buildLibsFromSource ??= true;

  if (!options.buildLibsFromSource) {
    const { tsConfigPath } = createTmpTsConfigForBuildableLibs(
      options.tsConfig,
      context
    );
    options.tsConfig = tsConfigPath;
  }

  return buildServerApp(options, context);
}

export default createBuilder<JsonObject & Schema>(
  executeWebpackServerBuilder
) as any;
