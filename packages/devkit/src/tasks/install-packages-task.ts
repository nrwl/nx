import { Tree } from '@nrwl/tao/src/shared/tree';
import { execSync } from 'child_process';
import { getPackageManagerCommand } from '@nrwl/tao/src/shared/package-manager';
import { join } from 'path';

let storedPackageJsonValue;

/**
 * Runs `npm install` or `yarn install`. It will skip running the install if
 * `package.json` hasn't changed at all or it hasn't changed since the last invocation.
 *
 * @param host - the file system tree
 * @param alwaysRun - always run the command even if `package.json` hasn't changed.
 */
export function installPackagesTask(
  host: Tree,
  alwaysRun: boolean = false,
  cwd: string = ''
) {
  const packageJsonValue = host.read(join(cwd, 'package.json')).toString();
  if (
    host.listChanges().find((f) => f.path === join(cwd, 'package.json')) ||
    alwaysRun
  ) {
    if (storedPackageJsonValue != packageJsonValue || alwaysRun) {
      storedPackageJsonValue = host.read(join(cwd, 'package.json')).toString();
      const pmc = getPackageManagerCommand();
      execSync(pmc.install, {
        cwd: join(host.root, cwd),
        stdio: [0, 1, 2],
      });
    }
  }
}
