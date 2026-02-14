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
 * @param alwaysRun - always run the command even if `package.json` hasn't changed.
 */
export function installPackagesTask(
  tree: Tree,
  alwaysRun: boolean = false,
  cwd: string = '',
  packageManager: PackageManager = detectPackageManager(join(tree.root, cwd))
): void {
  if (
    !tree
      .listChanges()
      .find((f) => f.path === joinPathFragments(cwd, 'package.json')) &&
    !alwaysRun
  ) {
    return;
  }

  const packageJsonValue = tree.read(
    joinPathFragments(cwd, 'package.json'),
    'utf-8'
  );
  let storedPackageJsonValue: string = global['__packageJsonInstallCache__'];
  // Don't install again if install was already executed with package.json
  if (storedPackageJsonValue != packageJsonValue || alwaysRun) {
    global['__packageJsonInstallCache__'] = packageJsonValue;
    const pmc = getPackageManagerCommand(packageManager);
    const execSyncOptions: ExecSyncOptions = {
      cwd: join(tree.root, cwd),
      stdio: process.env.NX_GENERATE_QUIET === 'true' ? 'ignore' : 'inherit',
      windowsHide: true,
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
