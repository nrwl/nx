// nx-ignore-next-line
import { ProjectGraphDependency } from '@nrwl/devkit';

export function trimBackSlash(value: string): string {
  return value.replace(/\/$/, '');
}

export function parseParentDirectoriesFromPilePath(
  path: string,
  workspaceRoot: string
) {
  const root = trimBackSlash(path);

  // split the source root on directory separator
  const split: string[] = root.split('/');

  // check the first part for libs or apps, depending on workspaceLayout
  if (split[0] === trimBackSlash(workspaceRoot)) {
    split.shift();
  }

  // pop off the last element, which should be the lib name
  split.pop();

  return split;
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
