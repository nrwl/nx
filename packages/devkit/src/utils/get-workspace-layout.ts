import type { Tree } from 'nx/src/generators/tree';
import { requireNx } from '../../nx';

const { readNxJson } = requireNx();

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
  /**
   * @deprecated This will be removed in Nx 17. Use {@link getNpmScope} instead.
   */
  npmScope: string;
} {
  const nxJson = readNxJson(tree);
  return {
    appsDir:
      nxJson?.workspaceLayout?.appsDir ??
      inOrderOfPreference(tree, ['apps', 'packages'], '.'),
    libsDir:
      nxJson?.workspaceLayout?.libsDir ??
      inOrderOfPreference(tree, ['libs', 'packages'], '.'),
    npmScope: nxJson?.npmScope,
    standaloneAsDefault: true,
  };
}

/**
 * Experimental
 */
export function extractLayoutDirectory(directory: string): {
  layoutDirectory: string;
  projectDirectory: string;
} {
  if (directory) {
    directory = directory.startsWith('/') ? directory.substring(1) : directory;
    for (let dir of ['apps', 'libs', 'packages']) {
      if (directory.startsWith(dir + '/') || directory === dir) {
        return {
          layoutDirectory: dir,
          projectDirectory: directory.substring(dir.length + 1),
        };
      }
    }
  }
  return { layoutDirectory: null, projectDirectory: directory };
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
