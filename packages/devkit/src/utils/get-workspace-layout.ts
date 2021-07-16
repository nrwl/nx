import { RawWorkspaceJsonConfiguration } from '@nrwl/tao/src/shared/workspace';

import { readNxJson } from '../generators/project-configuration';
import { readJson } from './json';

import type { Tree } from '@nrwl/tao/src/shared/tree';

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
  const nxJson = readNxJson(host);
  const rawWorkspace = readJson<RawWorkspaceJsonConfiguration>(
    host,
    getWorkspacePath(host)
  );

  return {
    appsDir: nxJson?.workspaceLayout?.appsDir ?? 'apps',
    libsDir: nxJson?.workspaceLayout?.libsDir ?? 'libs',
    npmScope: nxJson?.npmScope ?? '',
    standaloneAsDefault: Object.values(rawWorkspace.projects).reduce(
      // default for second, third... projects should be based on all projects being defined as a path
      // for configuration read from ng schematics, this is determined by configFilePath's presence
      (allStandalone, next) =>
        allStandalone && (typeof next === 'string' || 'configFilePath' in next),

      // default for first project should be false
      Object.values(rawWorkspace.projects).length > 0
    ),
  };
}

export function getWorkspacePath(host: Tree): string {
  const possibleFiles = ['/angular.json', '/workspace.json'];
  return possibleFiles.filter((path) => host.exists(path))[0];
}
