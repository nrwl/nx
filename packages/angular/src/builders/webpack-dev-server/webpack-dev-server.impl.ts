import {
  joinPathFragments,
  parseTargetString,
  readCachedProjectGraph,
} from '@nx/devkit';
import { WebpackNxBuildCoordinationPlugin } from '@nx/webpack/src/plugins/webpack-nx-build-coordination-plugin';
import { DependentBuildableProjectNode } from '@nx/js/src/utils/buildable-libs-utils';
import { readCachedProjectConfiguration } from 'nx/src/project-graph/project-graph';
import { existsSync } from 'fs';
import { isNpmProject } from 'nx/src/project-graph/operators';
import {
  mergeCustomWebpackConfig,
  resolveIndexHtmlTransformer,
} from '../utilities/webpack';
import { normalizeOptions } from './lib';
import type { Schema } from './schema';
import { createTmpTsConfigForBuildableLibs } from '../utilities/buildable-libs';
import { from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { getRootTsConfigPath } from '@nx/js';

type BuildTargetOptions = {
  tsConfig: string;
  buildLibsFromSource?: boolean;
  customWebpackConfig?: { path?: string };
  indexFileTransformer?: string;
};

export function executeWebpackDevServerBuilder(
  rawOptions: Schema,
  context: import('@angular-devkit/architect').BuilderContext
) {
  process.env.NX_TSCONFIG_PATH = getRootTsConfigPath();

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

  const buildTargetOptions: BuildTargetOptions = {
    ...buildTarget.options,
    ...(parsedBrowserTarget.configuration
      ? buildTarget.configurations[parsedBrowserTarget.configuration]
      : buildTarget.defaultConfiguration
      ? buildTarget.configurations[buildTarget.defaultConfiguration]
      : {}),
  };

  const buildLibsFromSource =
    options.buildLibsFromSource ??
    buildTargetOptions.buildLibsFromSource ??
    true;

  let pathToWebpackConfig: string;
  if (buildTargetOptions.customWebpackConfig?.path) {
    pathToWebpackConfig = joinPathFragments(
      context.workspaceRoot,
      buildTargetOptions.customWebpackConfig.path
    );

    if (pathToWebpackConfig && !existsSync(pathToWebpackConfig)) {
      throw new Error(
        `Custom Webpack Config File Not Found!\nTo use a custom webpack config, please ensure the path to the custom webpack file is correct: \n${pathToWebpackConfig}`
      );
    }
  }

  let pathToIndexFileTransformer: string;
  if (buildTargetOptions.indexFileTransformer) {
    pathToIndexFileTransformer = joinPathFragments(
      context.workspaceRoot,
      buildTargetOptions.indexFileTransformer
    );

    if (pathToIndexFileTransformer && !existsSync(pathToIndexFileTransformer)) {
      throw new Error(
        `File containing Index File Transformer function Not Found!\n Please ensure the path to the file containing the function is correct: \n${pathToIndexFileTransformer}`
      );
    }
  }

  let dependencies: DependentBuildableProjectNode[];
  if (!buildLibsFromSource) {
    const { tsConfigPath, dependencies: foundDependencies } =
      createTmpTsConfigForBuildableLibs(buildTargetOptions.tsConfig, context, {
        target: parsedBrowserTarget.target,
      });
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
    buildTargetOptions.tsConfig = tsConfigPath;
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
                // @ts-expect-error - difference between angular and webpack plugin definitions bc of webpack versions
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
            buildTargetOptions,
            context.target
          );
        },

        ...(pathToIndexFileTransformer
          ? {
              indexHtml: resolveIndexHtmlTransformer(
                pathToIndexFileTransformer,
                buildTargetOptions.tsConfig,
                context.target
              ),
            }
          : {}),
      })
    )
  );
}

export default require('@angular-devkit/architect').createBuilder(
  executeWebpackDevServerBuilder
) as any;
