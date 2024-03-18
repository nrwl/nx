import {
  logger,
  type ProjectGraph,
  type ProjectGraphDependency,
  type ProjectGraphExternalNode,
  readJsonFile,
} from '@nx/devkit';
import { DependentBuildableProjectNode } from './buildable-libs-utils';
import { join } from 'path';
import { readTsConfig } from './typescript/ts-config';
import { ExecutorOptions, SwcExecutorOptions } from './schema';
import { getSwcrcPath } from './swc/get-swcrc-path';

export enum HelperDependency {
  tsc = 'npm:tslib',
  swc = 'npm:@swc/helpers',
}

const jsExecutors = {
  '@nx/js:tsc': {
    helperDependency: HelperDependency.tsc,
    getConfigPath: (options: ExecutorOptions, contextRoot: string, _: string) =>
      join(contextRoot, options.tsConfig),
  } as const,
  '@nx/js:swc': {
    helperDependency: HelperDependency.swc,
    getConfigPath: (
      options: SwcExecutorOptions,
      contextRoot: string,
      projectRoot: string
    ) => getSwcrcPath(options, contextRoot, projectRoot),
  } as const,
} as const;

/**
 * Check and return a DependencyNode for the compiler's external helpers npm package. Return "null"
 * if it doesn't need it or it cannot be found in the Project Graph
 *
 * @param {HelperDependency} helperDependency
 * @param {string} configPath
 * @param {DependentBuildableProjectNode[]} dependencies
 * @param {ProjectGraph} projectGraph
 * @param {boolean=false} returnDependencyIfFound
 */
export function getHelperDependency(
  helperDependency: HelperDependency,
  configPath: string,
  dependencies: DependentBuildableProjectNode[],
  projectGraph: ProjectGraph,
  returnDependencyIfFound = false
): DependentBuildableProjectNode | null {
  const dependency = dependencies.find((dep) => dep.name === helperDependency);

  if (!!dependency) {
    // if a helperDependency is found, we either return null or the found dependency
    // We return the found return dependency for the cases where it is a part of a
    // project's dependency's dependency instead
    // eg: app-a -> lib-a (helperDependency is on lib-a instead of app-a)
    // When building app-a, we'd want to know about the found helper dependency still
    return returnDependencyIfFound ? dependency : null;
  }

  let isHelperNeeded = false;

  switch (helperDependency) {
    case HelperDependency.tsc:
      isHelperNeeded = !!readTsConfig(configPath).options['importHelpers'];
      break;
    case HelperDependency.swc:
      isHelperNeeded = !!readJsonFile(configPath)['jsc']['externalHelpers'];
      break;
  }

  if (!isHelperNeeded) return null;

  let libNode: ProjectGraphExternalNode | null = projectGraph[helperDependency];

  // If libNode is not found due to the version suffix from pnpm lockfile, try to match it by package name.
  if (!libNode) {
    for (const nodeName of Object.keys(projectGraph.externalNodes)) {
      const node = projectGraph.externalNodes[nodeName];
      if (`npm:${node.data.packageName}` === helperDependency) {
        libNode = node;
        break;
      }
    }
  }

  if (!libNode) {
    logger.warn(
      `Your library compilation option specifies that the compiler external helper (${
        helperDependency.split(':')[1]
      }) is needed but it is not installed.`
    );
    return null;
  }

  return {
    name: helperDependency,
    outputs: [],
    node: libNode,
  };
}

export function getHelperDependenciesFromProjectGraph(
  contextRoot: string,
  sourceProject: string,
  projectGraph: ProjectGraph
): ProjectGraphDependency[] {
  // if the source project isn't part of the projectGraph nodes; skip
  if (!projectGraph.nodes[sourceProject]) return [];

  // if the source project does not have any dependencies; skip
  if (
    !projectGraph.dependencies[sourceProject] ||
    !projectGraph.dependencies[sourceProject].length
  )
    return [];

  const sourceDependencies = projectGraph.dependencies[sourceProject];
  const internalDependencies = sourceDependencies.reduce(
    (result, dependency) => {
      // we check if a dependency is part of the workspace and if it's a library
      // because we wouldn't want to include external dependencies (npm packages)
      if (
        projectGraph.nodes[dependency.target] &&
        projectGraph.nodes[dependency.target].type === 'lib'
      ) {
        const targetData = projectGraph.nodes[dependency.target].data;

        // check if the dependency has a buildable target with one of the jsExecutors
        const targetExecutor = Object.values(targetData.targets).find(
          ({ executor }) => !!jsExecutors[executor]
        );
        if (targetExecutor) {
          const jsExecutor = jsExecutors[targetExecutor['executor']];

          const { root: projectRoot } = targetData;
          const configPath = jsExecutor.getConfigPath(
            targetExecutor['options'],
            contextRoot,
            projectRoot
          );

          // construct the correct helperDependency configurations
          // so we can compute the ProjectGraphDependency later
          result.push({
            helperDependency:
              jsExecutors[targetExecutor['executor']].helperDependency,
            dependencies: projectGraph.dependencies[dependency.target],
            configPath,
          });
        }
      }

      return result;
    },
    []
  );

  return internalDependencies.reduce(
    (result, { helperDependency, configPath, dependencies }) => {
      const dependency = getHelperDependency(
        helperDependency,
        configPath,
        dependencies,
        projectGraph,
        true
      );

      if (dependency) {
        result.push({
          type: 'static',
          source: sourceProject,
          target: dependency.name,
        } as ProjectGraphDependency);
      }

      return result;
    },
    [] as ProjectGraphDependency[]
  );
}
