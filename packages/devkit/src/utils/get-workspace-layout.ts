import type { Tree } from '@nrwl/tao/src/shared/tree';
import { readJson } from './json';
import type { NxJsonConfiguration } from '@nrwl/tao/src/shared/nx';
import {
  RawWorkspaceJsonConfiguration,
  workspaceConfigName,
} from '@nrwl/tao/src/shared/workspace';

/**
 * Returns workspace defaults. It includes defaults folders for apps and libs,
 * and the default scope.
 *
 * Example:
 *
 * ```typescript
 * { appsDir: 'apps', libsDir: 'libs', npmScope: 'myorg' }
 * ```
 * @param host - file system tree
 */
export function getWorkspaceLayout(host: Tree): {
  appsDir: string;
  libsDir: string;
  standaloneAsDefault: boolean;
  npmScope: string;
} {
  const nxJson = readJson<NxJsonConfiguration>(host, 'nx.json');
  const rawWorkspace = readJson<RawWorkspaceJsonConfiguration>(
    host,
    getWorkspacePath(host)
  );

  return {
    appsDir: nxJson.workspaceLayout?.appsDir ?? 'apps',
    libsDir: nxJson.workspaceLayout?.libsDir ?? 'libs',
    npmScope: nxJson.npmScope,
    standaloneAsDefault: Object.values(rawWorkspace.projects).reduce(
      //default for second, third... projects should be based on all projects being defined as a path
      (allStandalone, next) => allStandalone && typeof next === 'string',

      // default for first project should be false
      Object.values(rawWorkspace.projects).length > 0
    ),
  };
}

export function getWorkspacePath(host: Tree): string {
  const possibleFiles = ['/angular.json', '/workspace.json'];
  return possibleFiles.filter((path) => host.exists(path))[0];
}
