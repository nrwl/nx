import {
  joinPathFragments,
  normalizePath,
  ProjectGraph,
  readCachedProjectGraph,
  targetToTargetString,
} from '@nx/devkit';
import type { DependentBuildableProjectNode } from '@nx/js/internal';
import { existsSync } from 'fs';
import { relative } from 'path';
import { from, Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { assertPackageIsInstalled } from '../../executors/utilities/builder-package';
import { createTmpTsConfigForBuildableLibs } from '../utilities/buildable-libs';
import type { BrowserBuilderSchema } from './schema';
import { isNpmProject, getDependencyConfigs } from '@nx/devkit/internal';
// This is required to ensure that the webpack version used by the Module Federation is the same as the one used by the builders.
const Module = require('module');

const originalResolveFilename = Module._resolveFilename;
const patchedWebpackPath = require.resolve('webpack', {
  paths: [require.resolve('@angular-devkit/build-angular')],
});

// Override the resolve function
Module._resolveFilename = function (request, parent, isMain, options) {
  // Intercept webpack specifically
  if (request === 'webpack') {
    // Force webpack to resolve from your specific path
    return patchedWebpackPath;
  }

  // For all other modules, use the original resolver
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

function shouldSkipInitialTargetRun(
  projectGraph: ProjectGraph,
  project: string,
  target: string
): boolean {
  const allTargetNames = new Set<string>();
  for (const projectName in projectGraph.nodes) {
    const project = projectGraph.nodes[projectName];
    for (const targetName in project.data.targets ?? {}) {
      allTargetNames.add(targetName);
    }
  }

  const projectDependencyConfigs = getDependencyConfigs(
    { project, target },
    {},
    projectGraph,
    Array.from(allTargetNames)
  );

  // if the task runner already ran the target, skip the initial run
  return projectDependencyConfigs.some(
    (d) => d.target === target && d.projects === 'dependencies'
  );
}

export function executeWebpackBrowserBuilder(
  options: BrowserBuilderSchema,
  context: import('@angular-devkit/architect').BuilderContext
): Observable<import('@angular-devkit/architect').BuilderOutput> {
  assertPackageIsInstalled('@nx/webpack', '@nx/angular:webpack-browser');

  options.buildLibsFromSource ??= true;
  options.watchDependencies ??= true;

  const {
    buildLibsFromSource,
    customWebpackConfig,
    indexHtmlTransformer,
    watchDependencies,
    ...delegateBuilderOptions
  } = options;

  process.env.NX_BUILD_LIBS_FROM_SOURCE = `${buildLibsFromSource}`;
  process.env.NX_BUILD_TARGET = targetToTargetString({ ...context.target });

  const pathToWebpackConfig =
    customWebpackConfig?.path &&
    joinPathFragments(context.workspaceRoot, customWebpackConfig.path);
  if (pathToWebpackConfig && !existsSync(pathToWebpackConfig)) {
    throw new Error(
      `Custom Webpack Config File Not Found!\nTo use a custom webpack config, please ensure the path to the custom webpack file is correct: \n${pathToWebpackConfig}`
    );
  }

  const pathToIndexFileTransformer =
    indexHtmlTransformer &&
    joinPathFragments(context.workspaceRoot, indexHtmlTransformer);
  if (pathToIndexFileTransformer && !existsSync(pathToIndexFileTransformer)) {
    throw new Error(
      `File containing Index File Transformer function Not Found!\n Please ensure the path to the file containing the function is correct: \n${pathToIndexFileTransformer}`
    );
  }

  let dependencies: DependentBuildableProjectNode[];
  let projectGraph: ProjectGraph;
  if (!buildLibsFromSource) {
    projectGraph = readCachedProjectGraph();
    const { tsConfigPath, dependencies: foundDependencies } =
      createTmpTsConfigForBuildableLibs(
        delegateBuilderOptions.tsConfig,
        context,
        { projectGraph }
      );
    dependencies = foundDependencies;
    delegateBuilderOptions.tsConfig = normalizePath(
      relative(context.workspaceRoot, tsConfigPath)
    );
  }

  assertPackageIsInstalled(
    '@angular-devkit/build-angular',
    '@nx/angular:webpack-browser'
  );
  assertPackageIsInstalled('webpack-merge', '@nx/angular:webpack-browser');
  return from(
    Promise.all([
      import('@angular-devkit/build-angular'),
      import('@nx/webpack/internal'),
      import('../utilities/webpack.js'),
    ])
  ).pipe(
    switchMap(
      ([
        { executeBrowserBuilder },
        { WebpackNxBuildCoordinationPlugin },
        { mergeCustomWebpackConfig, resolveIndexHtmlTransformer },
      ]) =>
        executeBrowserBuilder(delegateBuilderOptions, context as any, {
          webpackConfiguration: (baseWebpackConfig) => {
            if (!buildLibsFromSource && delegateBuilderOptions.watch) {
              const workspaceDependencies = dependencies
                .filter((dep) => !isNpmProject(dep.node))
                .map((dep) => dep.node.name);
              // default for `nx run-many` is --all projects
              // by passing an empty string for --projects, run-many will default to
              // run the target for all projects.
              // This will occur when workspaceDependencies = []
              if (workspaceDependencies.length > 0) {
                const skipInitialRun = shouldSkipInitialTargetRun(
                  projectGraph,
                  context.target.project,
                  context.target.target
                );

                baseWebpackConfig.plugins.push(
                  // Cast away the angular/webpack plugin type difference (webpack versions).
                  new (WebpackNxBuildCoordinationPlugin as any)(
                    `nx run-many --target=${
                      context.target.target
                    } --projects=${workspaceDependencies.join(',')}`,
                    { skipInitialRun, skipWatchingDeps: !watchDependencies }
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
              delegateBuilderOptions,
              context.target
            );
          },
          ...(pathToIndexFileTransformer
            ? {
                indexHtml: resolveIndexHtmlTransformer(
                  pathToIndexFileTransformer,
                  delegateBuilderOptions.tsConfig,
                  context.target
                ),
              }
            : {}),
        })
    )
  );
}

export default require('@angular-devkit/architect').createBuilder(
  executeWebpackBrowserBuilder
) as any;
