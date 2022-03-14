import { BuilderContext, createBuilder } from '@angular-devkit/architect';
import {
  DevServerBuilderOptions,
  serveWebpackBrowser,
} from '@angular-devkit/build-angular/src/builders/dev-server';
import { JsonObject } from '@angular-devkit/core';
import { joinPathFragments, parseTargetString } from '@nrwl/devkit';
import { Workspaces } from 'nx/src/shared/workspace';
import { existsSync } from 'fs';
import { merge } from 'webpack-merge';
import { resolveCustomWebpackConfig } from '../utilities/webpack';
import { normalizeOptions } from './lib';
import type { Schema } from './schema';

export function webpackServer(schema: Schema, context: BuilderContext) {
  process.env.NX_TSCONFIG_PATH = joinPathFragments(
    context.workspaceRoot,
    'tsconfig.base.json'
  );

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
      return serveWebpackBrowser(
        options as DevServerBuilderOptions,
        context as any,
        {
          webpackConfiguration: async (baseWebpackConfig) => {
            const customWebpackConfiguration = resolveCustomWebpackConfig(
              pathToWebpackConfig,
              buildTarget.options.tsConfig
            );
            // The extra Webpack configuration file can export a synchronous or asynchronous function,
            // for instance: `module.exports = async config => { ... }`.
            if (typeof customWebpackConfiguration === 'function') {
              return customWebpackConfiguration(
                baseWebpackConfig,
                selectedConfiguration,
                context.target
              );
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
        }
      );
    } else {
      throw new Error(
        `Custom Webpack Config File Not Found!\nTo use a custom webpack config, please ensure the path to the custom webpack file is correct: \n${pathToWebpackConfig}`
      );
    }
  }

  return serveWebpackBrowser(
    options as DevServerBuilderOptions,
    context as any
  );
}

export default createBuilder<JsonObject & Schema>(webpackServer) as any;
