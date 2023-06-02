import type { ExecutorContext, ProjectGraph } from '@nx/devkit';
import {
  normalizePath,
  ProjectConfiguration,
  stripIndents,
  TargetConfiguration,
  workspaceRoot,
} from '@nx/devkit';
import { extname, join, relative } from 'path';
import { lstatSync } from 'fs';
import {
  createProjectRootMappings,
  findProjectForPath,
} from 'nx/src/project-graph/utils/find-project-for-path';
import { readProjectsConfigurationFromProjectGraph } from 'nx/src/project-graph/project-graph';
import { readNxJson } from 'nx/src/project-graph/file-utils';

export const CY_FILE_MATCHER = new RegExp(/\.cy\.[tj]sx?$/);
/**
 * return a path to a temp css file
 * temp file is scoped to the project root
 * i.e. <context.root>/tmp/<project-root>/ct-styles.css
 */
export function getTempTailwindPath(context: ExecutorContext) {
  if (!context.projectName) {
    throw new Error('No project name found in context');
  }
  const project = context?.projectGraph.nodes[context.projectName];

  if (!project) {
    throw new Error(
      `No project found in project graph for ${context.projectName}`
    );
  }

  if (project?.data?.root) {
    return join(context.root, 'tmp', project.data.root, 'ct-styles.css');
  }
}

/**
 * Checks if the childProjectName is a descendent of the parentProjectName
 * in the project graph
 **/
export function isCtProjectUsingBuildProject(
  graph: ProjectGraph,
  parentProjectName: string,
  childProjectName: string
): boolean {
  const isProjectDirectDep = graph.dependencies[parentProjectName].some(
    (p) => p.target === childProjectName
  );
  if (isProjectDirectDep) {
    return true;
  }
  const maybeIntermediateProjects = graph.dependencies[
    parentProjectName
  ].filter((p) => !graph.externalNodes[p.target]);

  for (const maybeIntermediateProject of maybeIntermediateProjects) {
    if (
      isCtProjectUsingBuildProject(
        graph,
        maybeIntermediateProject.target,
        childProjectName
      )
    ) {
      return true;
    }
  }
  return false;
}

export function getProjectConfigByPath(
  graph: ProjectGraph,
  configPath: string
): ProjectConfiguration {
  const configFileFromWorkspaceRoot = relative(workspaceRoot, configPath);
  const normalizedPathFromWorkspaceRoot = normalizePath(
    lstatSync(configPath).isFile()
      ? configFileFromWorkspaceRoot.replace(extname(configPath), '')
      : configFileFromWorkspaceRoot
  );

  const projectRootMappings = createProjectRootMappings(graph.nodes);
  const componentTestingProjectName = findProjectForPath(
    normalizedPathFromWorkspaceRoot,
    projectRootMappings
  );
  if (
    !componentTestingProjectName ||
    !graph.nodes[componentTestingProjectName]?.data
  ) {
    throw new Error(
      stripIndents`Unable to find the project configuration that includes ${normalizedPathFromWorkspaceRoot}. 
      Found project name? ${componentTestingProjectName}. 
      Graph has data? ${!!graph.nodes[componentTestingProjectName]?.data}`
    );
  }
  // make sure name is set since it can be undefined
  graph.nodes[componentTestingProjectName].data.name ??=
    componentTestingProjectName;
  return graph.nodes[componentTestingProjectName].data;
}

export function createExecutorContext(
  graph: ProjectGraph,
  targets: Record<string, TargetConfiguration>,
  projectName: string,
  targetName: string,
  configurationName: string
): ExecutorContext {
  const projectsConfigurations =
    readProjectsConfigurationFromProjectGraph(graph);
  const nxJsonConfiguration = readNxJson();
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
