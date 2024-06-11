import { execSync } from 'child_process';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';

/*
 * Because we don't want to depend on @nx/workspace (to speed up the workspace creation)
 * we duplicate the helper functions from @nx/workspace in this file.
 */

export const packageManagerList = ['pnpm', 'yarn', 'npm', 'bun'] as const;

export type PackageManager = (typeof packageManagerList)[number];

export function detectPackageManager(dir: string = ''): PackageManager {
  return existsSync(join(dir, 'bun.lockb'))
    ? 'bun'
    : existsSync(join(dir, 'yarn.lock'))
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
  preInstall?: string;
  globalAdd: string;
  // Make this required once bun adds programatically support for reading config https://github.com/oven-sh/bun/issues/7140
  getRegistryUrl?: string;
} {
  const pmVersion = getPackageManagerVersion(packageManager);
  const [pmMajor, pmMinor] = pmVersion.split('.');

  switch (packageManager) {
    case 'yarn':
      const useBerry = +pmMajor >= 2;
      const installCommand = 'yarn install --silent';
      return {
        preInstall: `yarn set version ${pmVersion}`,
        install: useBerry
          ? installCommand
          : `${installCommand} --ignore-scripts`,
        // using npx is necessary to avoid yarn classic manipulating the version detection when using berry
        exec: useBerry ? 'npx' : 'yarn',
        globalAdd: 'yarn global add',
        getRegistryUrl: useBerry
          ? 'yarn config get npmRegistryServer'
          : 'yarn config get registry',
      };

    case 'pnpm':
      let useExec = false;
      if ((+pmMajor >= 6 && +pmMinor >= 13) || +pmMajor >= 7) {
        useExec = true;
      }
      return {
        install: 'pnpm install --no-frozen-lockfile --silent --ignore-scripts',
        exec: useExec ? 'pnpm exec' : 'pnpx',
        globalAdd: 'pnpm add -g',
        getRegistryUrl: 'pnpm config get registry',
      };

    case 'npm':
      return {
        install: 'npm install --silent --ignore-scripts',
        exec: 'npx',
        globalAdd: 'npm i -g',
        getRegistryUrl: 'npm config get registry',
      };
    case 'bun':
      // bun doesn't current support programatically reading config https://github.com/oven-sh/bun/issues/7140
      return {
        install: 'bun install --silent --ignore-scripts',
        exec: 'bunx',
        globalAdd: 'bun install -g',
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
        // avoids errors when using nested yarn projects
        writeFileSync(join(root, 'yarn.lock'), '');
      }
      break;
  }
}

const pmVersionCache = new Map<PackageManager, string>();

export function getPackageManagerVersion(
  packageManager: PackageManager,
  cwd = process.cwd()
): string {
  if (pmVersionCache.has(packageManager)) {
    return pmVersionCache.get(packageManager) as string;
  }
  const version = execSync(`${packageManager} --version`, {
    cwd,
    encoding: 'utf-8',
  }).trim();
  pmVersionCache.set(packageManager, version);
  return version;
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
