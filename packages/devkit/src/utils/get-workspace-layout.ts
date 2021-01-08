import { Tree } from '@nrwl/tao/src/shared/tree';
import { readJson } from './json';
import { NxJsonConfiguration } from '@nrwl/tao/src/shared/nx';

/**
 * Returns workspace defaults. It includes defaults folders for apps and libs,
 * and the default scope.
 *
 * Example:
 *
 * `{ appsDir: 'apps', libsDir: 'libs', npmScope: 'myorg' }`
 * @param host - file system tree
 */
export function getWorkspaceLayout(
  host: Tree
): { appsDir: string; libsDir: string; npmScope: string } {
  const nxJson = readJson<NxJsonConfiguration>(host, 'nx.json');
  const layout = nxJson.workspaceLayout
    ? nxJson.workspaceLayout
    : { appsDir: 'apps', libsDir: 'libs' };
  const npmScope = nxJson.npmScope;
  return { ...layout, npmScope };
}

export function getWorkspacePath(host: Tree) {
  const possibleFiles = ['/angular.json', '/workspace.json'];
  return possibleFiles.filter((path) => host.exists(path))[0];
}
