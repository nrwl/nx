import {
  BuilderContext,
  BuilderOutput,
  createBuilder,
} from '@angular-devkit/architect';
import { executeBrowserBuilder } from '@angular-devkit/build-angular';
import { Schema } from '@angular-devkit/build-angular/src/builders/browser/schema';
import { JsonObject } from '@angular-devkit/core';
import { joinPathFragments } from '@nrwl/devkit';
import { existsSync } from 'fs';
import { Observable } from 'rxjs';
import { mergeCustomWebpackConfig } from '../utilities/webpack';
import { createTmpTsConfigForBuildableLibs } from '../utilities/buildable-libs';

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
    webpackConfiguration: (baseWebpackConfig) =>
      mergeCustomWebpackConfig(
        baseWebpackConfig,
        pathToWebpackConfig,
        options,
        context.target
      ),
  });
}

export function executeWebpackBrowserBuilder(
  options: BrowserBuilderSchema,
  context: BuilderContext
): Observable<BuilderOutput> {
  options.buildLibsFromSource ??= true;

  if (!options.buildLibsFromSource) {
    const { tsConfigPath } = createTmpTsConfigForBuildableLibs(
      options.tsConfig,
      context
    );
    options.tsConfig = tsConfigPath;
  }

  return buildApp(options, context);
}

export default createBuilder<JsonObject & BrowserBuilderSchema>(
  executeWebpackBrowserBuilder
) as any;
