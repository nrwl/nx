import type { ProjectGraph, ProjectGraphNode } from '@nrwl/devkit';
import { isAbsolute, relative } from 'path';
import { createProjectGraph } from '../core/project-graph';

export function projectHasTarget(project: ProjectGraphNode, target: string) {
  return project.data && project.data.targets && project.data.targets[target];
}

export function projectHasTargetAndConfiguration(
  project: ProjectGraphNode,
  target: string,
  configuration: string
) {
  return (
    projectHasTarget(project, target) &&
    project.data.targets[target].configurations &&
    project.data.targets[target].configurations[configuration]
  );
}

export function getSourceDirOfDependentProjects(
  projectName: string,
  projectGraph = createProjectGraph()
): string[] {
  if (!projectGraph.nodes[projectName]) {
    throw new Error(
      `Couldn't find project "${projectName}" in this Nx workspace`
    );
  }

  const nodeNames = findAllProjectNodeDependencies(projectName, projectGraph);
  return nodeNames.map(
    (nodeName) => projectGraph.nodes[nodeName].data.sourceRoot
  );
}

/**
 * Finds the project node name by a file that lives within it's src root
 * @param projRelativeDirPath directory path relative to the workspace root
 * @param projectGraph
 */
export function getProjectNameFromDirPath(
  projRelativeDirPath: string,
  projectGraph = createProjectGraph()
) {
  let parentNodeName = null;
  for (const [nodeName, node] of Object.entries(projectGraph.nodes)) {
    const relativePath = relative(node.data.root, projRelativeDirPath);
    const isMatch = relativePath && !relativePath.startsWith('..');

    if (isMatch || node.data.root === projRelativeDirPath) {
      parentNodeName = nodeName;
      break;
    }
  }

  if (!parentNodeName) {
    throw new Error(
      `Could not find any project containing the file "${projRelativeDirPath}" among it's project files`
    );
  }

  return parentNodeName;
}

/**
 * Takes a filename and figures out the belonging app and from there
 * collects all dependent
 * @param filename name of a file in some workspace app / lib
 */
function findAllProjectNodeDependencies(
  parentNodeName: string,
  projectGraph = createProjectGraph()
): string[] {
  const dependencyNodeNames = new Set<string>();

  collectDependentProjectNodesNames(
    projectGraph,
    dependencyNodeNames,
    parentNodeName
  );

  return Array.from(dependencyNodeNames);
}

// Recursively get all the dependencies of the node
function collectDependentProjectNodesNames(
  nxDeps: ProjectGraph,
  dependencyNodeNames: Set<string>,
  parentNodeName: string
) {
  const dependencies = nxDeps.dependencies[parentNodeName];
  if (!dependencies) {
    // no dependencies for the given node, so silently return,
    // as we probably wouldn't want to throw here
    return;
  }

  for (const dependency of dependencies) {
    const dependencyName = dependency.target;

    // we're only intersted in project dependencies, not npm
    if (dependencyName.startsWith('npm:')) {
      continue;
    }

    dependencyNodeNames.add(dependencyName);

    // Get the dependencies of the dependencies
    collectDependentProjectNodesNames(
      nxDeps,
      dependencyNodeNames,
      dependencyName
    );
  }
}
