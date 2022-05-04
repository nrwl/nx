import {
  readNxJson,
  shouldDefaultToUsingStandaloneConfigs,
} from 'nx/src/generators/utils/project-configuration';
import type { Tree } from 'nx/src/generators/tree';
import { detectWorkspaceScope } from 'nx/src/utils/path';
import { readJson } from 'nx/src/generators/utils/json';

export { getWorkspacePath } from 'nx/src/generators/utils/project-configuration';

/**
 * Returns workspace defaults. It includes defaults folders for apps and libs,
 * and the default scope.
 *
 * Example:
 *
 * ```typescript
 * { appsDir: 'apps', libsDir: 'libs', npmScope: 'myorg' }
 * ```
 * @param tree - file system tree
 */
export function getWorkspaceLayout(tree: Tree): {
  appsDir: string;
  libsDir: string;
  standaloneAsDefault: boolean;
  npmScope: string;
} {
  const nxJson = readNxJson(tree);
  return {
    appsDir: nxJson?.workspaceLayout?.appsDir ?? 'apps',
    libsDir: nxJson?.workspaceLayout?.libsDir ?? 'libs',
    npmScope:
      nxJson?.npmScope ||
      detectWorkspaceScope(readJson(tree, 'package.json').name),
    standaloneAsDefault: shouldDefaultToUsingStandaloneConfigs(tree),
  };
}
