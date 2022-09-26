import { join } from 'path';
import { platform } from 'os';
import { removeSync, existsSync, symlinkSync, lstatSync } from 'fs-extra';

/**
 * This function symlink workspace node_modules folder with app project's node_mdules folder.
 * For yarn and npm, it will symlink the entire node_modules folder.
 * If app project's node_modules already exist, it will remove it first then symlink it.
 * For pnpm, it will go through the package.json' dependencies and devDependencies, and also the required packages listed above.
 * @param workspaceRoot path of the workspace root
 * @param projectRoot path of app project root
 */
export function ensureNodeModulesSymlink(
  workspaceRoot: string,
  projectRoot: string
): void {
  const workspaceNodeModulesPath = join(workspaceRoot, 'node_modules');
  // Not using `existsSync` because it will return `true` it always follows symlinks, and will return `true` if the symlink is broken
  if (!lstatSync(workspaceNodeModulesPath, { throwIfNoEntry: false })) {
    throw new Error(`Cannot find ${workspaceNodeModulesPath}`);
  }

  const appNodeModulesPath = join(workspaceRoot, projectRoot, 'node_modules');
  // `mklink /D` requires admin privilege in Windows so we need to use junction
  const symlinkType = platform() === 'win32' ? 'junction' : 'dir';

  if (existsSync(appNodeModulesPath)) {
    removeSync(appNodeModulesPath);
  }
  symlinkSync(workspaceNodeModulesPath, appNodeModulesPath, symlinkType);
}
