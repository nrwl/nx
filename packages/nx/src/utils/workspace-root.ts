import * as path from 'path';
import { fileExists } from './fileutils';

/**
 * The root of the workspace
 */
export const workspaceRoot = workspaceRootInner(__dirname, null);

/**
 * The root of the workspace.
 *
 * @deprecated use workspaceRoot instead
 */
export const appRootPath = workspaceRoot;

export function workspaceRootInner(
  dir: string,
  candidateRoot: string | null
): string {
  if (process.env.NX_WORKSPACE_ROOT_PATH)
    return process.env.NX_WORKSPACE_ROOT_PATH;
  if (path.dirname(dir) === dir) return candidateRoot || process.cwd();
  if (fileExists(path.join(dir, 'nx.json'))) {
    return dir;
  } else if (fileExists(path.join(dir, 'node_modules', 'nx', 'package.json'))) {
    return workspaceRootInner(path.dirname(dir), dir);
  } else {
    return workspaceRootInner(path.dirname(dir), candidateRoot);
  }
}
