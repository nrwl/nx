import { join } from 'path';
import { platform } from 'os';
import { removeSync, existsSync, symlinkSync } from 'fs-extra';

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
  const worksapceNodeModulesPath = join(workspaceRoot, 'node_modules');
  if (!existsSync(worksapceNodeModulesPath)) {
    throw new Error(`Cannot find ${worksapceNodeModulesPath}`);
  }

  const appNodeModulesPath = join(workspaceRoot, projectRoot, 'node_modules');
  // `mklink /D` requires admin privilege in Windows so we need to use junction
  const symlinkType = platform() === 'win32' ? 'junction' : 'dir';

  if (existsSync(appNodeModulesPath)) {
    removeSync(appNodeModulesPath);
  }
  symlinkSync(worksapceNodeModulesPath, appNodeModulesPath, symlinkType);
}
