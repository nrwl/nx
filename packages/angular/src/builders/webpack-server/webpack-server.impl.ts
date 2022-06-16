import {
  BuilderContext,
  BuilderOutput,
  createBuilder,
} from '@angular-devkit/architect';
import {
  DevServerBuilderOptions,
  executeDevServerBuilder,
} from '@angular-devkit/build-angular';
import { JsonObject } from '@angular-devkit/core';
import {
  joinPathFragments,
  parseTargetString,
  readAllWorkspaceConfiguration,
  readCachedProjectGraph,
} from '@nrwl/devkit';
import { WebpackNxBuildCoordinationPlugin } from '@nrwl/web/src/plugins/webpack-nx-build-coordination-plugin';
import {
  calculateProjectDependencies,
  createTmpTsConfig,
  DependentBuildableProjectNode,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { existsSync } from 'fs';
import { isNpmProject } from 'nx/src/project-graph/operators';
import { Observable } from 'rxjs';
import { merge } from 'webpack-merge';
import { resolveCustomWebpackConfig } from '../utilities/webpack';
import { normalizeOptions } from './lib';
import type { Schema } from './schema';

export function executeWebpackServerBuilder(
  rawOptions: Schema,
  context: BuilderContext
): Observable<BuilderOutput> {
  const options = normalizeOptions(rawOptions);
  const workspaceConfig = readAllWorkspaceConfiguration();

  const parsedBrowserTarget = parseTargetString(options.browserTarget);
  const buildTarget =
    workspaceConfig.projects[parsedBrowserTarget.project].targets[
      parsedBrowserTarget.target
    ];

  const buildTargetConfiguration = parsedBrowserTarget.configuration
    ? buildTarget.configurations[parsedBrowserTarget.configuration]
    : buildTarget.defaultConfiguration
    ? buildTarget.configurations[buildTarget.defaultConfiguration]
    : undefined;

  const buildLibsFromSource =
    options.buildLibsFromSource ??
    buildTargetConfiguration?.buildLibsFromSource ??
    buildTarget.options.buildLibsFromSource ??
    true;

  const customWebpackConfig: { path: string } =
    buildTargetConfiguration?.customWebpackConfig ??
    buildTarget.options.customWebpackConfig;

  let pathToWebpackConfig: string;
  if (customWebpackConfig && customWebpackConfig.path) {
    pathToWebpackConfig = joinPathFragments(
      context.workspaceRoot,
      customWebpackConfig.path
    );

    if (!existsSync(pathToWebpackConfig)) {
      throw new Error(
        `Custom Webpack Config File Not Found!\nTo use a custom webpack config, please ensure the path to the custom webpack file is correct: \n${pathToWebpackConfig}`
      );
    }
  }

  let dependencies: DependentBuildableProjectNode[];
  if (!buildLibsFromSource) {
    const buildTargetTsConfigPath =
      buildTargetConfiguration?.tsConfig ?? buildTarget.options.tsConfig;
    const result = calculateProjectDependencies(
      readCachedProjectGraph(),
      context.workspaceRoot,
      context.target.project,
      parsedBrowserTarget.target,
      context.target.configuration
    );
    dependencies = result.dependencies;
    const updatedTsConfig = createTmpTsConfig(
      joinPathFragments(context.workspaceRoot, buildTargetTsConfigPath),
      context.workspaceRoot,
      result.target.data.root,
      dependencies
    );
    process.env.NX_TSCONFIG_PATH = updatedTsConfig;

    // We can't just pass the tsconfig path in memory to the angular builder
    // function because we can't pass the build target options to it, the build
    // targets options will be retrieved by the builder from the project
    // configuration. Therefore, we patch the method in the context to retrieve
    // the target options to overwrite the tsconfig path to use the generated
    // one with the updated path mappings.
    const originalGetTargetOptions = context.getTargetOptions;
    context.getTargetOptions = async (target) => {
      const options = await originalGetTargetOptions(target);
      options.tsConfig = updatedTsConfig;
      return options;
    };
  }

  return executeDevServerBuilder(options as DevServerBuilderOptions, context, {
    webpackConfiguration: async (baseWebpackConfig) => {
      if (!buildLibsFromSource) {
        const workspaceDependencies = dependencies
          .filter((dep) => !isNpmProject(dep.node))
          .map((dep) => dep.node.name);
        baseWebpackConfig.plugins.push(
          new WebpackNxBuildCoordinationPlugin(
            `nx run-many --target=${
              parsedBrowserTarget.target
            } --projects=${workspaceDependencies.join(',')}`
          )
        );
      }

      if (!pathToWebpackConfig) {
        return baseWebpackConfig;
      }

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
          buildTargetConfiguration,
          context.target
        );
      }

      return merge(baseWebpackConfig, config);
    },
  });
}

export default createBuilder<JsonObject & Schema>(
  executeWebpackServerBuilder
) as any;
