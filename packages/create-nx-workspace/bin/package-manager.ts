import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

/*
 * Because we don't want to depend on @nrwl/workspace (to speed up the workspace creation)
 * we duplicate the helper functions from @nrwl/workspace in this file.
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
  switch (packageManager) {
    case 'yarn':
      return {
        install: 'yarn',
        exec: 'yarn',
      };

    case 'pnpm':
      const [major, minor] = getPackageManagerVersion('pnpm').split('.');
      let useExec = false;
      if (+major >= 6 && +minor >= 13) {
        useExec = true;
      }
      return {
        install: 'pnpm install --no-frozen-lockfile', // explicitly disable in case of CI
        exec: useExec ? 'pnpm exec' : 'pnpx',
      };

    case 'npm':
      process.env.npm_config_legacy_peer_deps =
        process.env.npm_config_legacy_peer_deps ?? 'true';
      return {
        install: 'npm install',
        exec: 'npx',
      };
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
  console.log(invoker.path);
  for (const pkgManager of packageManagerList) {
    if (invoker.path.includes(pkgManager)) {
      detectedPackageManager = pkgManager;
      break;
    }
  }

  return detectedPackageManager;
}
