import {
  createProjectGraphAsync,
  parseTargetString,
  ProjectGraph,
  ProjectGraphDependency,
  readProjectConfiguration,
  TargetConfiguration,
  Tree,
} from '@nrwl/devkit';

interface FindTargetOptions {
  project: string;
  /**
   * contains buildable target such as react app or angular app
   * <project>:<target>[:<configuration>]
   */
  buildTarget?: string;
  validExecutorNames: Set<string>;
}

export async function findBuildConfig(
  tree: Tree,
  options: FindTargetOptions
): Promise<{ foundTarget: string; targetConfig: TargetConfiguration }> {
  // attempt to use the provided target
  if (options.buildTarget) {
    return {
      foundTarget: options.buildTarget,
      targetConfig: findInTarget(tree, options),
    };
  }
  // check to see if there is a valid config in the given project
  const [selfBuildTarget, selfProjectConfig] = findTargetOptionsInProject(
    tree,
    options.project,
    options.validExecutorNames
  );
  if (selfBuildTarget && selfProjectConfig) {
    return {
      targetConfig: selfProjectConfig,
      foundTarget: selfBuildTarget,
    };
  }

  // attempt to find any projects with the valid config in the graph that consumes this project
  const [graphBuildTarget, graphTargetConfig] = await findInGraph(
    tree,
    options
  );
  return {
    foundTarget: graphBuildTarget,
    targetConfig: graphTargetConfig,
  };
}

function findInTarget(tree: Tree, options: FindTargetOptions) {
  const { project, target, configuration } = parseTargetString(
    options.buildTarget
  );
  const projectConfig = readProjectConfiguration(tree, project);
  const foundConfig =
    configuration || projectConfig?.targets?.[target]?.defaultConfiguration;

  if (!foundConfig) {
    return projectConfig?.targets?.[target];
  }
  projectConfig.targets[target].options = {
    ...(projectConfig.targets[target]?.options || {}),
    ...projectConfig.targets[target]?.configurations[foundConfig],
  };
  return projectConfig.targets[target];
}

async function findInGraph(
  tree: Tree,
  options: FindTargetOptions
): Promise<[targetName: string, config: TargetConfiguration]> {
  const graph = await createProjectGraphAsync();
  const parents = findParentsOfProject(graph, options.project);
  if (parents.length > 0) {
    for (const parent of parents) {
      const [maybeBuildTarget, maybeTargetConfig] = findTargetOptionsInProject(
        tree,
        parent.source,
        options.validExecutorNames
      );
      if (maybeBuildTarget && maybeTargetConfig) {
        return [maybeBuildTarget, maybeTargetConfig];
      }
    }
  }
  return [null, null];
}

function findParentsOfProject(
  graph: ProjectGraph,
  projectName: string
): ProjectGraphDependency[] {
  const parents = [];
  for (const dep in graph.dependencies) {
    const f = graph.dependencies[dep].filter((d) => d.target === projectName);
    parents.push(...f);
  }
  return parents;
}

function findTargetOptionsInProject(
  tree: Tree,
  projectName: string,
  includes: Set<string>
): [buildTarget: string, config: TargetConfiguration] {
  const projectConfig = readProjectConfiguration(tree, projectName);

  for (const targetName in projectConfig.targets) {
    const targetConfig = projectConfig.targets[targetName];
    if (includes.has(targetConfig.executor)) {
      targetConfig.options = targetConfig.defaultConfiguration
        ? {
            ...targetConfig.options,
            ...targetConfig.configurations[targetConfig.defaultConfiguration],
          }
        : targetConfig.options;

      return [`${projectName}:${targetName}`, targetConfig];
    }
  }
  return [null, null];
}
