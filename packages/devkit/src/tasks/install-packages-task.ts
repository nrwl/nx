import type { Tree } from 'nx/src/generators/tree';
import { execSync } from 'child_process';
import { join } from 'path';
import {
  detectPackageManager,
  getPackageManagerCommand,
} from 'nx/src/utils/package-manager';
import type { PackageManager } from 'nx/src/utils/package-manager';
import { joinPathFragments } from 'nx/src/utils/path';

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
  packageManager: PackageManager = detectPackageManager(cwd)
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
    execSync(pmc.install, {
      cwd: join(tree.root, cwd),
      stdio: [0, 1, 2],
    });
  }
}
