import { Tree } from '@nrwl/tao/src/shared/tree';
import { execSync } from 'child_process';
import { join } from 'path';
import {
  detectPackageManager,
  getPackageManagerCommand,
} from '@nrwl/tao/src/shared/package-manager';

import { joinPathFragments } from '../utils/path';

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
  cwd: string = '',
  packageManager?: string
) {
  const packageJsonValue = host
    .read(joinPathFragments(cwd, 'package.json'))
    .toString();
  if (
    host
      .listChanges()
      .find((f) => f.path === joinPathFragments(cwd, 'package.json')) ||
    alwaysRun
  ) {
    // Don't install again if install was already executed with package.json
    if (storedPackageJsonValue != packageJsonValue || alwaysRun) {
      storedPackageJsonValue = host
        .read(joinPathFragments(cwd, 'package.json'))
        .toString();
      const pm = packageManager || detectPackageManager(cwd);
      const pmc = getPackageManagerCommand(pm);
      execSync(pmc.install, {
        cwd: join(host.root, cwd),
        stdio: [0, 1, 2],
      });
    }
  }
}
