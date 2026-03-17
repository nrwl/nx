import { execSync, type ExecSyncOptions } from 'child_process';
import { join } from 'path';

import {
  detectPackageManager,
  getPackageManagerCommand,
  joinPathFragments,
  PackageManager,
  Tree,
} from 'nx/src/devkit-exports';

/**
 * Runs `npm install` or `yarn install`. It will skip running the install if
 * `package.json` hasn't changed at all or it hasn't changed since the last invocation.
 *
 * @param tree - the file system tree
 * @param ensureInstall - ensure install runs even if `package.json` hasn't changed,
 * unless install already ran this generator cycle.
 */
export function installPackagesTask(
  tree: Tree,
  ensureInstall: boolean = false,
  cwd: string = '',
  packageManager: PackageManager = detectPackageManager(join(tree.root, cwd))
): void {
  const packageJsonPath = joinPathFragments(cwd, 'package.json');
  const packageJsonChanged = tree
    .listChanges()
    .some((f) => f.path === packageJsonPath);

  if (!packageJsonChanged && !ensureInstall) {
    return;
  }

  const packageJsonValue = tree.read(packageJsonPath, 'utf-8');
  let storedPackageJsonValue: string = global['__packageJsonInstallCache__'];
  // Skip if install already ran this cycle — the previous install already
  // picked up all filesystem changes (e.g. pnpm-workspace.yaml for symlinks).
  if (storedPackageJsonValue != null && ensureInstall) {
    return;
  }
  if (storedPackageJsonValue != packageJsonValue || ensureInstall) {
    global['__packageJsonInstallCache__'] = packageJsonValue;
    const pmc = getPackageManagerCommand(packageManager);
    const execSyncOptions: ExecSyncOptions = {
      cwd: join(tree.root, cwd),
      stdio: process.env.NX_GENERATE_QUIET === 'true' ? 'ignore' : 'inherit',
      windowsHide: false,
    };
    // ensure local registry from process is not interfering with the install
    // when we start the process from temp folder the local registry would override the custom registry
    if (
      process.env.npm_config_registry &&
      process.env.npm_config_registry.match(
        /^https:\/\/registry\.(npmjs\.org|yarnpkg\.com)/
      )
    ) {
      delete process.env.npm_config_registry;
    }
    execSync(pmc.install, execSyncOptions);
  }
}
