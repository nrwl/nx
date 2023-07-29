import { dirname } from 'path';
import { ProjectGraphProjectNode } from '../../config/project-graph';
import { ProjectConfiguration } from '../../config/workspace-json-project-json';
import { normalizePath } from '../../utils/path';

export type ProjectRootMappings = Map<string, string>;

/**
 * This creates a map of project roots to project names to easily look up the project of a file
 * @param projects This is the map of project configurations commonly found in "workspace.json"
 */
export function createProjectRootMappingsFromProjectConfigurations(
  projects: Record<string, ProjectConfiguration>
) {
  const projectRootMappings: ProjectRootMappings = new Map();
  for (const projectName of Object.keys(projects)) {
    const root = projects[projectName].root;
    projectRootMappings.set(normalizeProjectRoot(root), projectName);
  }
  return projectRootMappings;
}

/**
 * This creates a map of project roots to project names to easily look up the project of a file
 * @param nodes This is the nodes from the project graph
 */
export function createProjectRootMappings(
  nodes: Record<string, ProjectGraphProjectNode>
): ProjectRootMappings {
  const projectRootMappings = new Map<string, string>();
  for (const projectName of Object.keys(nodes)) {
    let root = nodes[projectName].data.root;

    projectRootMappings.set(normalizeProjectRoot(root), projectName);
  }
  return projectRootMappings;
}

/**
 * Locates a project in projectRootMap based on a file within it
 * @param filePath path that is inside of projectName. This should be relative from the workspace root
 * @param projectRootMap Map<projectRoot, projectName> Use {@link createProjectRootMappings} to create this
 */
export function findProjectForPath(
  filePath: string,
  projectRootMap: ProjectRootMappings
): string | null {
  /**
   * Project Mappings are in UNIX-style file paths
   * Windows may pass Win-style file paths
   * Ensure filePath is in UNIX-style
   */
  let currentPath = normalizePath(filePath);
  for (
    ;
    currentPath != dirname(currentPath);
    currentPath = dirname(currentPath)
  ) {
    const p = projectRootMap.get(currentPath);
    if (p) {
      return p;
    }
  }
  return projectRootMap.get(currentPath);
}

export function normalizeProjectRoot(root: string) {
  root = root === '' ? '.' : root;
  return root && root.endsWith('/') ? root.substring(0, root.length - 1) : root;
}
