import { execSync } from 'child_process';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';

/*
 * Because we don't want to depend on @nx/workspace (to speed up the workspace creation)
 * we duplicate the helper functions from @nx/workspace in this file.
 */

export const packageManagerList = ['pnpm', 'yarn', 'npm'] as const;

export type PackageManager = typeof packageManagerList[number];

export function detectPackageManager(dir: string = ''): PackageManager {
  return existsSync(join(dir, 'yarn.lock'))
    ? 'yarn'
    : existsSync(join(dir, 'pnpm-lock.yaml'))
    ? 'pnpm'
    : 'npm';
}

/**
 * Returns commands for the package manager used in the workspace.
 * By default, the package manager is derived based on the lock file,
 * but it can also be passed in explicitly.
 *
 * Example:
 *
 * ```javascript
 * execSync(`${getPackageManagerCommand().addDev} my-dev-package`);
 * ```
 *
 */
export function getPackageManagerCommand(
  packageManager: PackageManager = detectPackageManager()
): {
  install: string;
  exec: string;
} {
  const [pmMajor, pmMinor] =
    getPackageManagerVersion(packageManager).split('.');

  switch (packageManager) {
    case 'yarn':
      const useBerry = +pmMajor >= 2;
      const installCommand = 'yarn install --silent';
      return {
        install: useBerry
          ? installCommand
          : `${installCommand} --ignore-scripts`,
        exec: 'yarn',
      };

    case 'pnpm':
      let useExec = false;
      if ((+pmMajor >= 6 && +pmMinor >= 13) || +pmMajor >= 7) {
        useExec = true;
      }
      return {
        install: 'pnpm install --no-frozen-lockfile --silent --ignore-scripts',
        exec: useExec ? 'pnpm exec' : 'pnpx',
      };

    case 'npm':
      return {
        install: 'npm install --silent --ignore-scripts',
        exec: 'npx',
      };
  }
}

export function generatePackageManagerFiles(
  root: string,
  packageManager: PackageManager = detectPackageManager()
) {
  const [pmMajor] = getPackageManagerVersion(packageManager).split('.');
  switch (packageManager) {
    case 'yarn':
      if (+pmMajor >= 2) {
        writeFileSync(
          join(root, '.yarnrc.yml'),
          'nodeLinker: node-modules\nenableScripts: false'
        );
      }
      break;
  }
}

export function getPackageManagerVersion(
  packageManager: PackageManager
): string {
  return execSync(`${packageManager} --version`).toString('utf-8').trim();
}

/**
 * Detects which package manager was used to invoke create-nx-{plugin|workspace} command
 * based on the main Module process that invokes the command
 * - npx returns 'npm'
 * - pnpx returns 'pnpm'
 * - yarn create returns 'yarn'
 *
 * Default to 'npm'
 */
export function detectInvokedPackageManager(): PackageManager {
  let detectedPackageManager: PackageManager = 'npm';
  // mainModule is deprecated since Node 14, fallback for older versions
  const invoker = require.main || process['mainModule'];

  // default to `npm`
  if (!invoker) {
    return detectedPackageManager;
  }
  for (const pkgManager of packageManagerList) {
    if (invoker.path.includes(pkgManager)) {
      detectedPackageManager = pkgManager;
      break;
    }
  }

  return detectedPackageManager;
}
