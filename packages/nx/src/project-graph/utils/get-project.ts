import type { ProjectGraphProjectNode } from '../../config/project-graph';
import { removeExt } from '../../utils/fileutils';
import { dirname } from 'path';

/**
 * Maps the file paths to the project name, both with and without the file extension
 * apps/myapp/src/main.ts -> { 'apps/myapp/src/main': 'myapp', 'apps/myapp/src/main.ts': 'myapp' }
 * @param projectGraph nodes
 * @returns
 */
export function createProjectPathMappings(
  nodes: Record<string, ProjectGraphProjectNode>
): Record<string, string> {
  const result: Record<string, string> = {};
  Object.entries(nodes).forEach(([name, node]) => {
    if (node?.data?.root) {
      result[node.data.root] = name;
    }
    node.data.files.forEach(({ file }) => {
      const fileName = removeExt(file);
      result[fileName] = name;
      result[file] = name;
    });
  });

  return result;
}

/**
 * Locates a project in projectRootMap based on a file within it
 * @param filePath path that is inside of projectName
 * @param projectPathMappings Map<projectRoot, projectName> Use {@link #createProjectPathMappings} to create this
 */
export function getProjectForPath(
  filePath: string,
  projectPathMappings: Record<string, string>
): string | null {
  for (
    let currentPath = filePath;
    currentPath != dirname(currentPath);
    currentPath = dirname(currentPath)
  ) {
    const p = projectPathMappings[currentPath];
    if (p) {
      return p;
    }
  }
  return null;
}
