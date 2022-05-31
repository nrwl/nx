import { existsSync } from 'fs';
import * as path from 'path';
import { workspaceRootInner } from './workspace-root';

/**
 * Recursive function that walks back up the directory
 * tree to try and find a workspace file.
 *
 * @param dir Directory to start searching with
 */
export function findWorkspaceRoot(dir: string): WorkspaceTypeAndRoot | null {
  const r = workspaceRootInner(dir, null);

  if (existsSync(path.join(r, 'angular.json'))) {
    return { type: 'angular', dir: r };
  }

  if (existsSync(path.join(r, 'nx.json'))) {
    return { type: 'nx', dir: r };
  }

  if (existsSync(path.join(r, 'node_modules', 'nx', 'package.json'))) {
    return { type: 'nx', dir: r };
  }

  return null;
}

export interface WorkspaceTypeAndRoot {
  type: 'nx' | 'angular';
  dir: string;
}
