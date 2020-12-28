import { Tree } from '@nrwl/tao/src/shared/tree';
import { getPackageManagerCommand } from '@nrwl/tao/src/shared/package-manager';
import { execSync } from 'child_process';

let storedPackageJsonValue;

/**
 * Runs `npm install` or `yarn install`. It will skip running the install if
 * `package.json` hasn't changed at all or it hasn't changed since the last invocation.
 *
 * @param host - the file system tree
 * @param alwaysRun - always run the command even if `package.json` hasn't changed.
 */
export function installPackagesTask(host: Tree, alwaysRun: boolean = false) {
  const packageJsonValue = host.read('package.json').toString();
  if (host.listChanges().find((f) => f.path === 'package.json') || alwaysRun) {
    if (storedPackageJsonValue != packageJsonValue || alwaysRun) {
      storedPackageJsonValue = host.read('package.json').toString();
      const pmc = getPackageManagerCommand();
      execSync(pmc.install, {
        cwd: host.root,
        stdio: [0, 1, 2],
      });
    }
  }
}
