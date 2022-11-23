import { join } from 'path';
import { ProjectGraph, ProjectGraphProjectNode } from '../config/project-graph';
import { TargetConfiguration } from '../config/workspace-json-project-json';
import { readCachedProjectGraph } from '../project-graph/project-graph';
import { readJsonFile } from './fileutils';
import { buildTargetFromScript, PackageJson } from './package-json';
import { joinPathFragments, normalizePath } from './path';
import { workspaceRoot } from './workspace-root';

export function projectHasTarget(
  project: ProjectGraphProjectNode,
  target: string
) {
  return !!(
    project.data &&
    project.data.targets &&
    project.data.targets[target]
  );
}

export function projectHasTargetAndConfiguration(
  project: ProjectGraphProjectNode,
  target: string,
  configuration: string
) {
  return (
    projectHasTarget(project, target) &&
    project.data.targets[target].configurations &&
    project.data.targets[target].configurations[configuration]
  );
}

export function mergeNpmScriptsWithTargets(
  projectRoot: string,
  targets
): Record<string, TargetConfiguration> {
  try {
    const { scripts, nx }: PackageJson = readJsonFile(
      join(projectRoot, 'package.json')
    );
    const res: Record<string, TargetConfiguration> = {};
    // handle no scripts
    Object.keys(scripts || {}).forEach((script) => {
      if (!nx?.includedScripts || nx?.includedScripts.includes(script)) {
        res[script] = buildTargetFromScript(script, nx);
      }
    });
    return { ...res, ...(targets || {}) };
  } catch (e) {
    return targets;
  }
}

export function getSourceDirOfDependentProjects(
  projectName: string,
  projectGraph = readCachedProjectGraph()
): [projectDirs: string[], warnings: string[]] {
  if (!projectGraph.nodes[projectName]) {
    throw new Error(
      `Couldn't find project "${projectName}" in this Nx workspace`
    );
  }

  const nodeNames = findAllProjectNodeDependencies(projectName, projectGraph);
  return nodeNames.reduce(
    (result, nodeName) => {
      if (projectGraph.nodes[nodeName].data.sourceRoot) {
        result[0].push(projectGraph.nodes[nodeName].data.sourceRoot);
      } else {
        result[1].push(nodeName);
      }
      return result;
    },
    [[], []] as [projectDirs: string[], warnings: string[]]
  );
}

/**
 * Finds the project node name by a file that lives within it's src root
 * @param projRelativeDirPath directory path relative to the workspace root
 * @param projectGraph
 */
export function getProjectNameFromDirPath(
  projRelativeDirPath: string,
  projectGraph = readCachedProjectGraph()
) {
  const isRootPath = (path: string): boolean => path === '.' || path === '';
  // sort projects descending by root path segments length to ensure we first test
  // against the more nested projects
  const sortedNodeEntries = Object.entries(projectGraph.nodes).sort(
    ([, nodeA], [, nodeB]) => {
      // ensure the project at the root path comes last
      if (isRootPath(nodeA.data.root)) {
        return 1;
      }
      if (isRootPath(nodeB.data.root)) {
        return -1;
      }

      return (
        normalizePath(nodeB.data.root).split('/').length -
        normalizePath(nodeA.data.root).split('/').length
      );
    }
  );

  const normalizedDirPath = joinPathFragments(
    workspaceRoot,
    projRelativeDirPath
  );
  for (const [name, node] of sortedNodeEntries) {
    const normalizedProjectRootPath = joinPathFragments(
      workspaceRoot,
      node.data.root
    );
    if (normalizedDirPath.startsWith(normalizedProjectRootPath)) {
      return name;
    }
  }

  throw new Error(
    `Could not find any project containing the file "${projRelativeDirPath}" among it's project files`
  );
}

/**
 * Find all internal project dependencies.
 * All the external (npm) dependencies will be filtered out
 * @param {string} parentNodeName
 * @param {ProjectGraph} projectGraph
 * @returns {string[]}
 */
export function findAllProjectNodeDependencies(
  parentNodeName: string,
  projectGraph = readCachedProjectGraph()
): string[] {
  const dependencyNodeNames = new Set<string>();

  collectDependentProjectNodesNames(
    projectGraph as ProjectGraph,
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

    // skip dependencies already added (avoid circular dependencies)
    if (dependencyNodeNames.has(dependencyName)) {
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
