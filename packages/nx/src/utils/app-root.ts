import * as path from 'path';
import { statSync } from 'fs';

/**
 * The root of the workspace.
 *
 * @deprecated use workspaceRoot instead
 */
export const appRootPath = pathInner(__dirname);

/**
 * The root of the workspace
 */
export const workspaceRoot = appRootPath;

function pathInner(dir: string): string {
  if (process.env.NX_WORKSPACE_ROOT_PATH)
    return process.env.NX_WORKSPACE_ROOT_PATH;
  if (path.dirname(dir) === dir) return process.cwd();
  if (
    fileExists(path.join(dir, 'workspace.json')) ||
    fileExists(path.join(dir, 'nx.json')) ||
    fileExists(path.join(dir, 'angular.json'))
  ) {
    return dir;
  } else {
    return pathInner(path.dirname(dir));
  }
}

export function fileExists(filePath: string): boolean {
  try {
    return statSync(filePath).isFile();
  } catch (err) {
    return false;
  }
}
