import { existsSync } from 'fs';
import * as path from 'path';
import { Workspace } from './workspace';

/**
 * Recursive function that walks back up the directory
 * tree to try and find a workspace file.
 *
 * @param dir Directory to start searching with
 */
export function findWorkspaceRoot(dir: string): Workspace | null {
  if (existsSync(path.join(dir, 'angular.json'))) {
    return { type: 'angular', dir };
  }

  if (existsSync(path.join(dir, 'nx.json'))) {
    return { type: 'nx', dir };
  }

  if (path.dirname(dir) === dir) {
    return null;
  }

  return findWorkspaceRoot(path.dirname(dir));
}
