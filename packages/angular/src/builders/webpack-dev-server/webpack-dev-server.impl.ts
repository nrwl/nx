import {
  joinPathFragments,
  parseTargetString,
  readCachedProjectGraph,
} from '@nrwl/devkit';
import { WebpackNxBuildCoordinationPlugin } from '@nrwl/webpack/src/plugins/webpack-nx-build-coordination-plugin';
import { DependentBuildableProjectNode } from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { readCachedProjectConfiguration } from 'nx/src/project-graph/project-graph';
import { existsSync } from 'fs';
import { isNpmProject } from 'nx/src/project-graph/operators';
import { mergeCustomWebpackConfig } from '../utilities/webpack';
import { normalizeOptions } from './lib';
import type { Schema } from './schema';
import { createTmpTsConfigForBuildableLibs } from '../utilities/buildable-libs';
import { from } from 'rxjs';
import { switchMap } from 'rxjs/operators';

export function executeWebpackDevServerBuilder(
  rawOptions: Schema,
  context: import('@angular-devkit/architect').BuilderContext
) {
  process.env.NX_TSCONFIG_PATH = joinPathFragments(
    context.workspaceRoot,
    'tsconfig.base.json'
  );

  const options = normalizeOptions(rawOptions);

  const parsedBrowserTarget = parseTargetString(
    options.browserTarget,
    readCachedProjectGraph()
  );
  const browserTargetProjectConfiguration = readCachedProjectConfiguration(
    parsedBrowserTarget.project
  );

  const buildTarget =
    browserTargetProjectConfiguration.targets[parsedBrowserTarget.target];

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
    const { tsConfigPath, dependencies: foundDependencies } =
      createTmpTsConfigForBuildableLibs(
        buildTargetTsConfigPath,
        context,
        parsedBrowserTarget.target
      );
    dependencies = foundDependencies;

    // We can't just pass the tsconfig path in memory to the angular builder
    // function because we can't pass the build target options to it, the build
    // targets options will be retrieved by the builder from the project
    // configuration. Therefore, we patch the method in the context to retrieve
    // the target options to overwrite the tsconfig path to use the generated
    // one with the updated path mappings.
    const originalGetTargetOptions = context.getTargetOptions;
    context.getTargetOptions = async (target) => {
      const options = await originalGetTargetOptions(target);
      options.tsConfig = tsConfigPath;
      return options;
    };

    // The buildTargetConfiguration also needs to use the generated tsconfig path
    // otherwise the build will fail if customWebpack function/file is referencing
    // local libs. This synchronize the behavior with webpack-browser and
    // webpack-server implementation.
    buildTargetConfiguration.tsConfig = tsConfigPath;
  }

  return from(import('@angular-devkit/build-angular')).pipe(
    switchMap(({ executeDevServerBuilder }) =>
      executeDevServerBuilder(options, context, {
        webpackConfiguration: async (baseWebpackConfig) => {
          if (!buildLibsFromSource) {
            const workspaceDependencies = dependencies
              .filter((dep) => !isNpmProject(dep.node))
              .map((dep) => dep.node.name);
            // default for `nx run-many` is --all projects
            // by passing an empty string for --projects, run-many will default to
            // run the target for all projects.
            // This will occur when workspaceDependencies = []
            if (workspaceDependencies.length > 0) {
              baseWebpackConfig.plugins.push(
                new WebpackNxBuildCoordinationPlugin(
                  `nx run-many --target=${
                    parsedBrowserTarget.target
                  } --projects=${workspaceDependencies.join(',')}`
                )
              );
            }
          }

          if (!pathToWebpackConfig) {
            return baseWebpackConfig;
          }

          return mergeCustomWebpackConfig(
            baseWebpackConfig,
            pathToWebpackConfig,
            buildTargetConfiguration,
            context.target
          );
        },
      })
    )
  );
}

export default require('@angular-devkit/architect').createBuilder(
  executeWebpackDevServerBuilder
) as any;
