import {
  BuilderContext,
  BuilderOutput,
  createBuilder,
} from '@angular-devkit/architect';
import { executeBrowserBuilder } from '@angular-devkit/build-angular';
import { Schema } from '@angular-devkit/build-angular/src/builders/browser/schema';
import { JsonObject } from '@angular-devkit/core';
import { joinPathFragments } from '@nrwl/devkit';
import { Workspaces } from '@nrwl/tao/src/shared/workspace';
import { readCachedProjectGraph } from '@nrwl/workspace/src/core/project-graph';
import {
  calculateProjectDependencies,
  checkDependentProjectsHaveBeenBuilt,
  createTmpTsConfig,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { existsSync } from 'fs';
import { join } from 'path';
import { from, Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { merge } from 'webpack-merge';
import { resolveCustomWebpackConfig } from '../utilities/webpack';

export type BrowserBuilderSchema = Schema & {
  customWebpackConfig?: {
    path: string;
  };
  additionalConfigurations: string[];
};

function getAdditionalConfigurations(
  additionalConfigurations: string[],
  context: BuilderContext
) {
  if (!additionalConfigurations || additionalConfigurations.length === 0) {
    return {};
  }
  const workspaceConfig = new Workspaces(
    context.workspaceRoot
  ).readWorkspaceConfiguration();

  const selectedTarget =
    workspaceConfig.projects[context.target.project].targets[
      context.target.target
    ];

  const mergedAdditionalConfigurations = additionalConfigurations.reduce(
    (config, configurationName) => {
      if (!(configurationName in selectedTarget.configurations)) {
        throw new Error(
          `Could not find configuration "${configurationName}" in "${context.target.target}" for project "${context.target.project}".`
        );
      }
      return {
        ...config,
        ...selectedTarget.configurations[configurationName],
      };
    },
    {}
  );

  return mergedAdditionalConfigurations;
}

function buildApp(
  options: BrowserBuilderSchema,
  context: BuilderContext
): Observable<BuilderOutput> {
  const { customWebpackConfig, additionalConfigurations, ...delegateOptions } =
    options;

  const mergedOptions = {
    ...delegateOptions,
    ...getAdditionalConfigurations(additionalConfigurations, context),
  };

  // If there is a path to custom webpack config
  // Invoke our own support for custom webpack config
  if (customWebpackConfig && customWebpackConfig.path) {
    const pathToWebpackConfig = joinPathFragments(
      context.workspaceRoot,
      customWebpackConfig.path
    );

    if (existsSync(pathToWebpackConfig)) {
      return buildAppWithCustomWebpackConfiguration(
        mergedOptions,
        context,
        pathToWebpackConfig
      );
    } else {
      throw new Error(
        `Custom Webpack Config File Not Found!\nTo use a custom webpack config, please ensure the path to the custom webpack file is correct: \n${pathToWebpackConfig}`
      );
    }
  }

  return executeBrowserBuilder(mergedOptions, context);
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
      // The extra Webpack configuration file can export a synchronous or asynchronous function,
      // for instance: `module.exports = async config => { ... }`.
      if (typeof customWebpackConfiguration === 'function') {
        return customWebpackConfiguration(
          baseWebpackConfig,
          options,
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

export default createBuilder<JsonObject & BrowserBuilderSchema>(run) as any;
