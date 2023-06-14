import {
  createProjectGraphAsync,
  ExecutorContext,
  logger,
  parseTargetString,
  ProjectGraph,
  ProjectGraphDependency,
  readProjectConfiguration,
  readTargetOptions,
  reverse,
  stripIndents,
  TargetConfiguration,
  Tree,
  workspaceRoot,
} from '@nx/devkit';
import { readNxJson } from 'nx/src/project-graph/file-utils';
import { readProjectsConfigurationFromProjectGraph } from 'nx/src/project-graph/project-graph';

interface FindTargetOptions {
  project: string;
  /**
   * contains buildable target such as react app or angular app
   * <project>:<target>[:<configuration>]
   */
  buildTarget?: string;
  validExecutorNames: Set<string>;
  skipGetOptions?: boolean;
}

export interface FoundTarget {
  config?: TargetConfiguration;
  target: string;
}

export async function findBuildConfig(
  tree: Tree,
  options: FindTargetOptions
): Promise<FoundTarget> {
  try {
    // attempt to use the provided target
    const graph = await createProjectGraphAsync();
    if (options.buildTarget) {
      return {
        target: options.buildTarget,
        config: findInTarget(tree, graph, options),
      };
    }
    // check to see if there is a valid config in the given project
    const selfProject = findTargetOptionsInProject(
      tree,
      graph,
      options.project,
      options
    );
    if (selfProject) {
      return selfProject;
    }

    // attempt to find any projects with the valid config in the graph that consumes this project
    return await findInGraph(tree, graph, options);
  } catch (e) {
    logger.error(e);
    throw new Error(stripIndents`Error trying to find build configuration. Try manually specifying the build target with the --build-target flag.
    Provided project? ${options.project}
    Provided build target? ${options.buildTarget}
    Provided Executors? ${[...options.validExecutorNames].join(', ')}`);
  }
}

function findInTarget(
  tree: Tree,
  graph: ProjectGraph,
  options: FindTargetOptions
): TargetConfiguration {
  const { project, target, configuration } = parseTargetString(
    options.buildTarget
  );
  const projectConfig = readProjectConfiguration(tree, project);
  const executorName = projectConfig?.targets?.[target]?.executor;
  if (!options.validExecutorNames.has(executorName)) {
    logger.error(stripIndents`NX The provided build target, ${
      options.buildTarget
    }, uses the '${executorName}' executor.
But only the follow executors are allowed
${Array.from(options.validExecutorNames)
  .map((ve) => ` - ${ve}`)
  .join('\n')}

This is most likely because the provided --build-target is not a build target for an application.
For example, the provide build target, '${options.buildTarget}' is:
 - the build target for a buildable/publishable library instead of an app.
 - using a different framework than expected like react library using an angular app build target.

If you do not have an app in the workspace to you can make a new app with 'nx g app' and use it just for component testing
`);
    throw new Error(
      'The provided --build-target does not use an executor in the allow list of executors defined.'
    );
  }
  const foundConfig =
    configuration || projectConfig?.targets?.[target]?.defaultConfiguration;

  return readTargetOptions(
    { project, target, configuration: foundConfig },
    createExecutorContext(
      graph,
      projectConfig.targets,
      project,
      target,
      foundConfig
    )
  );
}

async function findInGraph(
  tree: Tree,
  graph: ProjectGraph,
  options: FindTargetOptions
): Promise<FoundTarget> {
  const parents = findParentsOfProject(graph, options.project);
  const potentialTargets = [];

  for (const parent of parents) {
    const parentProject = findTargetOptionsInProject(
      tree,
      graph,
      parent.target,
      options
    );
    if (parentProject) {
      potentialTargets.push(parentProject);
    }
  }

  if (potentialTargets.length > 1) {
    logger.warn(stripIndents`Multiple potential targets found for ${options.project}. Found ${potentialTargets.length}.
    Using ${potentialTargets[0].target}.
    To specify a different target use the --build-target flag.
    `);
  }
  return potentialTargets[0];
}

function findParentsOfProject(
  graph: ProjectGraph,
  projectName: string
): ProjectGraphDependency[] {
  const reversedGraph = reverse(graph);
  return reversedGraph.dependencies[projectName]
    ? Object.values(reversedGraph.dependencies[projectName])
    : [];
}

function findTargetOptionsInProject(
  tree: Tree,
  graph: ProjectGraph,
  projectName: string,
  options: FindTargetOptions
): FoundTarget {
  const projectConfig = readProjectConfiguration(tree, projectName);

  const includes = options.validExecutorNames;

  for (const targetName in projectConfig.targets) {
    const targetConfig = projectConfig.targets[targetName];
    if (includes.has(targetConfig.executor)) {
      return {
        target: `${projectName}:${targetName}`,
        config: !options.skipGetOptions
          ? readTargetOptions(
              { project: projectName, target: targetName },
              createExecutorContext(
                graph,
                projectConfig.targets,
                projectName,
                targetName,
                null
              )
            )
          : null,
      };
    }
  }
}

function createExecutorContext(
  graph: ProjectGraph,
  targets: Record<string, TargetConfiguration>,
  projectName: string,
  targetName: string,
  configurationName?: string
): ExecutorContext {
  const nxJsonConfiguration = readNxJson();
  const projectsConfigurations =
    readProjectsConfigurationFromProjectGraph(graph);
  return {
    cwd: process.cwd(),
    projectGraph: graph,
    target: targets[targetName],
    targetName,
    configurationName,
    root: workspaceRoot,
    isVerbose: false,
    projectName,
    projectsConfigurations,
    nxJsonConfiguration,
  };
}
