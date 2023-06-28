import {
  joinPathFragments,
  ProjectGraph,
  readCachedProjectGraph,
} from '@nx/devkit';
import type { DependentBuildableProjectNode } from '@nx/js/src/utils/buildable-libs-utils';
import { WebpackNxBuildCoordinationPlugin } from '@nx/webpack/src/plugins/webpack-nx-build-coordination-plugin';
import { existsSync } from 'fs';
import { readNxJson } from 'nx/src/project-graph/file-utils';
import { isNpmProject } from 'nx/src/project-graph/operators';
import { getDependencyConfigs } from 'nx/src/tasks-runner/utils';
import { from, Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { createTmpTsConfigForBuildableLibs } from '../utilities/buildable-libs';
import {
  mergeCustomWebpackConfig,
  resolveIndexHtmlTransformer,
} from '../utilities/webpack';
import type { BrowserBuilderSchema } from './schema';
import { validateOptions } from './validate-options';

function shouldSkipInitialTargetRun(
  projectGraph: ProjectGraph,
  project: string,
  target: string
): boolean {
  const nxJson = readNxJson();
  const defaultDependencyConfigs = Object.entries(
    nxJson.targetDefaults ?? {}
  ).reduce((acc, [targetName, dependencyConfig]) => {
    acc[targetName] = dependencyConfig.dependsOn;
    return acc;
  }, {});
  const projectDependencyConfigs = getDependencyConfigs(
    { project, target },
    defaultDependencyConfigs,
    projectGraph
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
  validateOptions(options);
  options.buildLibsFromSource ??= true;

  const {
    buildLibsFromSource,
    customWebpackConfig,
    indexFileTransformer,
    ...delegateBuilderOptions
  } = options;

  const pathToWebpackConfig =
    customWebpackConfig?.path &&
    joinPathFragments(context.workspaceRoot, customWebpackConfig.path);
  if (pathToWebpackConfig && !existsSync(pathToWebpackConfig)) {
    throw new Error(
      `Custom Webpack Config File Not Found!\nTo use a custom webpack config, please ensure the path to the custom webpack file is correct: \n${pathToWebpackConfig}`
    );
  }

  const pathToIndexFileTransformer =
    indexFileTransformer &&
    joinPathFragments(context.workspaceRoot, indexFileTransformer);
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
    delegateBuilderOptions.tsConfig = tsConfigPath;
  }

  return from(import('@angular-devkit/build-angular')).pipe(
    switchMap(({ executeBrowserBuilder }) =>
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
                // @ts-expect-error - difference between angular and webpack plugin definitions bc of webpack versions
                new WebpackNxBuildCoordinationPlugin(
                  `nx run-many --target=${
                    context.target.target
                  } --projects=${workspaceDependencies.join(',')}`,
                  skipInitialRun
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
