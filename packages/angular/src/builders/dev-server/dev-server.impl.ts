import type { BuilderContext } from '@angular-devkit/architect';
import type { DevServerBuilderOptions } from '@angular-devkit/build-angular';
import {
  joinPathFragments,
  normalizePath,
  parseTargetString,
  readCachedProjectGraph,
  readProjectsConfigurationFromProjectGraph,
  workspaceRoot,
} from '@nx/devkit';
import { getRootTsConfigPath } from '@nx/js';
import type { DependentBuildableProjectNode } from '@nx/js/src/utils/buildable-libs-utils';
import { WebpackNxBuildCoordinationPlugin } from '@nx/webpack/src/plugins/webpack-nx-build-coordination-plugin';
import { existsSync } from 'fs';
import { isNpmProject } from 'nx/src/project-graph/operators';
import { readCachedProjectConfiguration } from 'nx/src/project-graph/project-graph';
import { relative } from 'path';
import { combineLatest, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { getInstalledAngularVersionInfo } from '../../executors/utilities/angular-version-utils';
import {
  loadIndexHtmlTransformer,
  loadMiddleware,
  loadPlugins,
  type PluginSpec,
} from '../../executors/utilities/esbuild-extensions';
import { patchBuilderContext } from '../../executors/utilities/patch-builder-context';
import { createTmpTsConfigForBuildableLibs } from '../utilities/buildable-libs';
import {
  mergeCustomWebpackConfig,
  resolveIndexHtmlTransformer,
} from '../utilities/webpack';
import { normalizeOptions, validateOptions } from './lib';
import type {
  NormalizedSchema,
  Schema,
  SchemaWithBrowserTarget,
} from './schema';
import { readNxJson } from 'nx/src/config/configuration';

type BuildTargetOptions = {
  tsConfig: string;
  buildLibsFromSource?: boolean;
  customWebpackConfig?: { path?: string };
  indexHtmlTransformer?: string;
  indexFileTransformer?: string;
  plugins?: string[] | PluginSpec[];
  esbuildMiddleware?: string[];
};

export function executeDevServerBuilder(
  rawOptions: Schema,
  context: import('@angular-devkit/architect').BuilderContext
) {
  validateOptions(rawOptions);

  process.env.NX_TSCONFIG_PATH = getRootTsConfigPath();

  const options = normalizeOptions(rawOptions);

  const projectGraph = readCachedProjectGraph();

  const parsedBuildTarget = parseTargetString(options.buildTarget, {
    cwd: context.currentDirectory,
    projectGraph,
    projectName: context.target.project,
    projectsConfigurations:
      readProjectsConfigurationFromProjectGraph(projectGraph),
    root: context.workspaceRoot,
    nxJsonConfiguration: readNxJson(workspaceRoot),
    isVerbose: false,
  });
  const browserTargetProjectConfiguration = readCachedProjectConfiguration(
    parsedBuildTarget.project
  );

  const buildTarget =
    browserTargetProjectConfiguration.targets[parsedBuildTarget.target];

  const buildTargetOptions: BuildTargetOptions = {
    ...buildTarget.options,
    ...(parsedBuildTarget.configuration
      ? buildTarget.configurations[parsedBuildTarget.configuration]
      : buildTarget.defaultConfiguration
      ? buildTarget.configurations[buildTarget.defaultConfiguration]
      : {}),
  };

  const buildLibsFromSource =
    options.buildLibsFromSource ??
    buildTargetOptions.buildLibsFromSource ??
    true;

  process.env.NX_BUILD_LIBS_FROM_SOURCE = `${buildLibsFromSource}`;
  process.env.NX_BUILD_TARGET = options.buildTarget;

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

  const normalizedIndexHtmlTransformer =
    buildTargetOptions.indexHtmlTransformer ??
    buildTargetOptions.indexFileTransformer;
  let pathToIndexFileTransformer: string;
  if (normalizedIndexHtmlTransformer) {
    pathToIndexFileTransformer = joinPathFragments(
      context.workspaceRoot,
      normalizedIndexHtmlTransformer
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
        target: parsedBuildTarget.target,
      });
    dependencies = foundDependencies;
    const relativeTsConfigPath = normalizePath(
      relative(context.workspaceRoot, tsConfigPath)
    );

    // We can't just pass the tsconfig path in memory to the angular builder
    // function because we can't pass the build target options to it, the build
    // targets options will be retrieved by the builder from the project
    // configuration. Therefore, we patch the method in the context to retrieve
    // the target options to overwrite the tsconfig path to use the generated
    // one with the updated path mappings.
    const originalGetTargetOptions = context.getTargetOptions;
    context.getTargetOptions = async (target) => {
      const options = await originalGetTargetOptions(target);
      options.tsConfig = relativeTsConfigPath;
      return options;
    };

    // The buildTargetConfiguration also needs to use the generated tsconfig path
    // otherwise the build will fail if customWebpack function/file is referencing
    // local libs. This synchronize the behavior with webpack-browser and
    // webpack-server implementation.
    buildTargetOptions.tsConfig = relativeTsConfigPath;
  }

  const delegateBuilderOptions = getDelegateBuilderOptions(options);
  const isUsingWebpackBuilder = ![
    '@angular-devkit/build-angular:application',
    '@angular-devkit/build-angular:browser-esbuild',
    '@nx/angular:application',
    '@nx/angular:browser-esbuild',
  ].includes(buildTarget.executor);

  /**
   * The Angular CLI dev-server builder make some decisions based on the build
   * target builder but it only considers `@angular-devkit/build-angular:*`
   * builders. Since we are using a custom builder, we patch the context to
   * handle `@nx/angular:*` executors.
   */
  patchBuilderContext(context, !isUsingWebpackBuilder, parsedBuildTarget);

  return combineLatest([
    from(import('@angular-devkit/build-angular')),
    from(loadPlugins(buildTargetOptions.plugins, buildTargetOptions.tsConfig)),
    from(
      loadMiddleware(options.esbuildMiddleware, buildTargetOptions.tsConfig)
    ),
    from(
      loadIndexHtmlFileTransformer(
        pathToIndexFileTransformer,
        buildTargetOptions.tsConfig,
        context,
        isUsingWebpackBuilder
      )
    ),
  ]).pipe(
    switchMap(
      ([
        { executeDevServerBuilder },
        plugins,
        middleware,
        indexHtmlTransformer,
      ]) =>
        executeDevServerBuilder(
          delegateBuilderOptions,
          context,
          {
            webpackConfiguration: isUsingWebpackBuilder
              ? async (baseWebpackConfig) => {
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
                            parsedBuildTarget.target
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
                }
              : undefined,

            ...(indexHtmlTransformer
              ? {
                  indexHtml: indexHtmlTransformer,
                }
              : {}),
          },
          {
            buildPlugins: plugins,
            middleware,
          }
        )
    )
  );
}

export default require('@angular-devkit/architect').createBuilder(
  executeDevServerBuilder
) as any;

function getDelegateBuilderOptions(
  options: NormalizedSchema
): DevServerBuilderOptions {
  const delegateBuilderOptions: NormalizedSchema & DevServerBuilderOptions = {
    ...options,
  };

  const { major: angularMajorVersion } = getInstalledAngularVersionInfo();
  if (angularMajorVersion <= 17) {
    (
      delegateBuilderOptions as unknown as SchemaWithBrowserTarget
    ).browserTarget = delegateBuilderOptions.buildTarget;
    delete delegateBuilderOptions.buildTarget;
  }

  // delete extra option not supported by the delegate builder
  delete delegateBuilderOptions.buildLibsFromSource;

  return delegateBuilderOptions;
}

async function loadIndexHtmlFileTransformer(
  pathToIndexFileTransformer: string | undefined,
  tsConfig: string,
  context: BuilderContext,
  isUsingWebpackBuilder: boolean
) {
  if (!pathToIndexFileTransformer) {
    return undefined;
  }

  return isUsingWebpackBuilder
    ? resolveIndexHtmlTransformer(
        pathToIndexFileTransformer,
        tsConfig,
        context.target
      )
    : await loadIndexHtmlTransformer(pathToIndexFileTransformer, tsConfig);
}
