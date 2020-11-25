import { Tree } from '@nrwl/tao/src/shared/tree';
import { readJson } from './read-json';
import { NxJson } from '@nrwl/tao/src/shared/nx';

/**
 * Gets the configured workspace layout.
 *
 * Defaults to `{ appsDir: 'apps', libsDir: 'libs' }`
 * @param host
 */
export function getWorkspaceLayout(
  host: Tree
): { appsDir?: string; libsDir?: string } {
  const nxJson = readJson<NxJson>(host, 'nx.json');
  return nxJson.workspaceLayout
    ? nxJson.workspaceLayout
    : { appsDir: 'apps', libsDir: 'libs' };
}

/**
 * Returns the path to the workspace.json
 * @param host
 */
export function getWorkspacePath(host: Tree) {
  const possibleFiles = ['/workspace.json', '/angular.json', '/.angular.json'];
  return possibleFiles.filter((path) => host.exists(path))[0];
}
