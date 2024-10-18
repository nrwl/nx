import { readNxJson, Tree } from 'nx/src/devkit-exports';

/**
 * Returns workspace defaults. It includes defaults folders for apps and libs,
 * and the default scope.
 *
 * Example:
 *
 * ```typescript
 * { appsDir: 'apps', libsDir: 'libs' }
 * ```
 * @param tree - file system tree
 *
 * @deprecated Generators should accept the full path via a --directory argument.
 */
export function getWorkspaceLayout(tree: Tree): {
  appsDir: string;
  libsDir: string;
  standaloneAsDefault: boolean;
} {
  const nxJson = readNxJson(tree);
  return {
    appsDir:
      nxJson?.workspaceLayout?.appsDir ??
      inOrderOfPreference(tree, ['apps', 'packages'], '.'),
    libsDir:
      nxJson?.workspaceLayout?.libsDir ??
      inOrderOfPreference(tree, ['libs', 'packages'], '.'),
    standaloneAsDefault: true,
  };
}

/**
 * Experimental
 */
export function extractLayoutDirectory(directory?: string): {
  layoutDirectory: string | null;
  projectDirectory?: string;
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
