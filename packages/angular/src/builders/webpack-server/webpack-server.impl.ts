import { BuilderContext, createBuilder } from '@angular-devkit/architect';
import { JsonObject } from '@angular-devkit/core';
import type { Schema } from './schema';

import { parseTargetString, joinPathFragments } from '@nrwl/devkit';
import { Workspaces } from '@nrwl/tao/src/shared/workspace';
import {
  DevServerBuilderOptions,
  serveWebpackBrowser,
} from '@angular-devkit/build-angular/src/dev-server';
import { existsSync } from 'fs';
import { merge } from 'webpack-merge';
import { normalizeOptions } from './lib';

export function webpackServer(schema: Schema, context: BuilderContext) {
  const options = normalizeOptions(schema);
  const workspaceConfig = new Workspaces(
    context.workspaceRoot
  ).readWorkspaceConfiguration();

  const parsedBrowserTarget = parseTargetString(options.browserTarget);
  const buildTarget =
    workspaceConfig.projects[parsedBrowserTarget.project].targets[
      parsedBrowserTarget.target
    ];

  const selectedConfiguration = parsedBrowserTarget.configuration
    ? buildTarget.configurations[parsedBrowserTarget.configuration]
    : buildTarget.defaultConfiguration
    ? buildTarget.configurations[buildTarget.defaultConfiguration]
    : buildTarget.options;

  const customWebpackConfig: { path: string } =
    selectedConfiguration.customWebpackConfig ??
    buildTarget.options.customWebpackConfig;

  if (customWebpackConfig && customWebpackConfig.path) {
    const pathToWebpackConfig = joinPathFragments(
      context.workspaceRoot,
      customWebpackConfig.path
    );

    if (existsSync(pathToWebpackConfig)) {
      return serveWebpackBrowser(options as DevServerBuilderOptions, context, {
        webpackConfiguration: (baseWebpackConfig) => {
          const customWebpackConfiguration = require(pathToWebpackConfig);
          return merge(baseWebpackConfig, customWebpackConfiguration);
        },
      });
    } else {
      throw new Error(
        `Custom Webpack Config File Not Found!\nTo use a custom webpack config, please ensure the path to the custom webpack file is correct: \n${pathToWebpackConfig}`
      );
    }
  }

  return serveWebpackBrowser(options as DevServerBuilderOptions, context);
}

export default createBuilder<JsonObject & Schema>(webpackServer);
