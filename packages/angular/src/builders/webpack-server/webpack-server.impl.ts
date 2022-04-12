import { BuilderContext, createBuilder } from '@angular-devkit/architect';
import {
  DevServerBuilderOptions,
  DevServerBuilderOutput,
  serveWebpackBrowser,
} from '@angular-devkit/build-angular/src/builders/dev-server';
import { JsonObject } from '@angular-devkit/core';
import {
  joinPathFragments,
  parseTargetString,
  readAllWorkspaceConfiguration,
  readCachedProjectGraph,
  Workspaces,
} from '@nrwl/devkit';
import { existsSync } from 'fs';
import { merge } from 'webpack-merge';
import { resolveCustomWebpackConfig } from '../utilities/webpack';
import { normalizeOptions } from './lib';
import type { Schema } from './schema';
import {
  calculateProjectDependencies,
  checkDependentProjectsHaveBeenBuilt,
  createTmpTsConfig,
  DependentBuildableProjectNode,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { join } from 'path';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

export function executeWebpackServerBuilder(
  schema: Schema,
  context: BuilderContext
) {
  process.env.NX_TSCONFIG_PATH = joinPathFragments(
    context.workspaceRoot,
    'tsconfig.base.json'
  );

  const options = normalizeOptions(schema);
  const workspaceConfig = readAllWorkspaceConfiguration();

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

  const buildLibsFromSource: boolean =
    selectedConfiguration.buildLibsFromSource ??
    buildTarget.options.buildLibsFromSource ??
    true;

  let dependencies: DependentBuildableProjectNode[];

  if (!buildLibsFromSource) {
    const result = calculateProjectDependencies(
      readCachedProjectGraph(),
      context.workspaceRoot,
      context.target.project,
      context.target.target,
      context.target.configuration
    );
    dependencies = result.dependencies;

    buildTarget.options.tsConfig = createTmpTsConfig(
      join(context.workspaceRoot, buildTarget.options.tsConfig),
      context.workspaceRoot,
      result.target.data.root,
      dependencies
    );
    process.env.NX_TSCONFIG_PATH = buildTarget.options.tsConfig;

    const originalGetTargetOptions = context.getTargetOptions;

    context.getTargetOptions = async (target) => {
      const options = await originalGetTargetOptions(target);

      options.tsConfig = buildTarget.options.tsConfig;

      return options;
    };
  }

  const customWebpackConfig: { path: string } =
    selectedConfiguration.customWebpackConfig ??
    buildTarget.options.customWebpackConfig;

  let webpackBrowser$: Observable<DevServerBuilderOutput>;

  if (customWebpackConfig && customWebpackConfig.path) {
    const pathToWebpackConfig = joinPathFragments(
      context.workspaceRoot,
      customWebpackConfig.path
    );

    if (existsSync(pathToWebpackConfig)) {
      webpackBrowser$ = serveWebpackBrowser(
        options as DevServerBuilderOptions,
        context,
        {
          webpackConfiguration: async (baseWebpackConfig) => {
            const customWebpackConfiguration = resolveCustomWebpackConfig(
              pathToWebpackConfig,
              buildTarget.options.tsConfig
            );
            // The extra Webpack configuration file can also export a Promise, for instance:
            // `module.exports = new Promise(...)`. If it exports a single object, but not a Promise,
            // then await will just resolve that object.
            const config = await customWebpackConfiguration;

            // The extra Webpack configuration file can export a synchronous or asynchronous function,
            // for instance: `module.exports = async config => { ... }`.
            if (typeof config === 'function') {
              return config(
                baseWebpackConfig,
                selectedConfiguration,
                context.target
              );
            } else {
              return merge(baseWebpackConfig, config);
            }
          },
        }
      );
    } else {
      throw new Error(
        `Custom Webpack Config File Not Found!\nTo use a custom webpack config, please ensure the path to the custom webpack file is correct: \n${pathToWebpackConfig}`
      );
    }
  } else {
    webpackBrowser$ = serveWebpackBrowser(
      options as DevServerBuilderOptions,
      context
    );
  }

  return of(
    !buildLibsFromSource
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
        return webpackBrowser$;
      } else {
        // just pass on the result
        return of({ success: false });
      }
    })
  );
}

export default createBuilder<JsonObject & Schema>(
  executeWebpackServerBuilder
) as any;
