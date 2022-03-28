import { execSync } from 'child_process';

/*
 * Because we don't want to depend on @nrwl/workspace (to speed up the workspace creation)
 * we duplicate the helper functions from @nrwl/workspace in this file.
 */

export const packageManagerList = ['npm', 'yarn', 'pnpm'] as const;

export type PackageManager = typeof packageManagerList[number];

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
  packageManager: PackageManager = 'npm'
): {
  install: string;
  add: string;
  addDev: string;
  rm: string;
  exec: string;
  list: string;
  run: (script: string, args: string) => string;
} {
  switch (packageManager) {
    case 'yarn':
      return {
        install: 'yarn',
        add: 'yarn add -W',
        addDev: 'yarn add -D -W',
        rm: 'yarn remove',
        exec: 'yarn',
        run: (script: string, args: string) => `yarn ${script} ${args}`,
        list: 'yarn list',
      };

    case 'pnpm':
      const [major, minor] = getPackageManagerVersion('pnpm').split('.');
      let useExec = false;
      if (+major >= 6 && +minor >= 13) {
        useExec = true;
      }
      return {
        install: 'pnpm install --no-frozen-lockfile', // explicitly disable in case of CI
        add: 'pnpm add',
        addDev: 'pnpm add -D',
        rm: 'pnpm rm',
        exec: useExec ? 'pnpm exec' : 'pnpx',
        run: (script: string, args: string) => `pnpm run ${script} -- ${args}`,
        list: 'pnpm ls --depth 100',
      };

    case 'npm':
      process.env.npm_config_legacy_peer_deps =
        process.env.npm_config_legacy_peer_deps ?? 'true';
      return {
        install: 'npm install',
        add: 'npm install',
        addDev: 'npm install -D',
        rm: 'npm rm',
        exec: 'npx',
        run: (script: string, args: string) => `npm run ${script} -- ${args}`,
        list: 'npm ls',
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

  for (const pkgManager of packageManagerList) {
    if (invoker.path.includes(pkgManager)) {
      detectedPackageManager = pkgManager;
      break;
    }
  }

  return detectedPackageManager;
}
