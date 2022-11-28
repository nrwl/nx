import {
  readNxJson,
  shouldDefaultToUsingStandaloneConfigs,
} from 'nx/src/generators/utils/project-configuration';
import type { Tree } from 'nx/src/generators/tree';

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
  const nxConfig = readNxJson(tree);
  return {
    appsDir:
      nxConfig?.workspaceLayout?.appsDir ??
      inOrderOfPreference(tree, ['apps', 'packages'], '.'),
    libsDir:
      nxConfig?.workspaceLayout?.libsDir ??
      inOrderOfPreference(tree, ['libs', 'packages'], '.'),
    npmScope: nxConfig?.npmScope,
    standaloneAsDefault: shouldDefaultToUsingStandaloneConfigs(tree),
  };
}

function inOrderOfPreference(
  tree: Tree,
  selectedFolders: string[],
  defaultChoice: string
) {
  for (let i = 0; i < selectedFolders.length; ++i) {
    if (tree.exists(selectedFolders[i])) return selectedFolders[i];
  }
  return defaultChoice;
}
