// nx-ignore-next-line
import { ProjectGraphDependency } from '@nrwl/devkit';

export function trimBackSlash(value: string): string {
  return value.replace(/\/$/, '');
}

export function parseParentDirectoriesFromFilePath(
  path: string,
  workspaceRoot: string
) {
  const directories = path
    .replace(workspaceRoot, '')
    .split('/')
    .filter((directory) => directory !== '');
  // last directory is the project
  directories.pop();
  return directories;
}

export function hasPath(
  dependencies: Record<string, ProjectGraphDependency[]>,
  target: string,
  node: string,
  visited: string[],
  currentSearchDepth: number,
  maxSearchDepth: number = -1 // -1 indicates unlimited search depth
) {
  if (target === node) return true;

  if (maxSearchDepth === -1 || currentSearchDepth <= maxSearchDepth) {
    for (let d of dependencies[node] || []) {
      if (visited.indexOf(d.target) > -1) continue;
      visited.push(d.target);
      if (
        hasPath(
          dependencies,
          target,
          d.target,
          visited,
          currentSearchDepth + 1,
          maxSearchDepth
        )
      )
        return true;
    }
  }

  return false;
}
