import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

export type PackageManager = 'yarn' | 'pnpm' | 'npm';

export interface PackageManagerCommands {
  install: string;
  add: string;
  addDev: string;
  rm: string;
  exec: string;
  list: string;
  run: (script: string, args: string) => string;
}

/**
 * Detects which package manager is used in the workspace based on the lock file.
 */
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
 */
export function getPackageManagerCommand(
  packageManager: PackageManager = detectPackageManager()
): PackageManagerCommands {
  const commands: { [pm in PackageManager]: () => PackageManagerCommands } = {
    yarn: () => ({
      install: 'yarn',
      add: 'yarn add',
      addDev: 'yarn add -D',
      rm: 'yarn remove',
      exec: 'yarn',
      run: (script: string, args: string) => `yarn ${script} ${args}`,
      list: 'yarn list',
    }),
    pnpm: () => ({
      install: 'pnpm install --no-frozen-lockfile', // explicitly disable in case of CI
      add: 'pnpm add',
      addDev: 'pnpm add -D',
      rm: 'pnpm rm',
      exec: 'pnpx',
      run: (script: string, args: string) => `pnpm run ${script} -- ${args}`,
      list: 'pnpm ls --depth 100',
    }),
    npm: () => {
      process.env.npm_config_legacy_peer_deps ??= 'true';

      return {
        install: 'npm install',
        add: 'npm install',
        addDev: 'npm install -D',
        rm: 'npm rm',
        exec: 'npx',
        run: (script: string, args: string) => `npm run ${script} -- ${args}`,
        list: 'npm ls',
      };
    },
  };

  return commands[packageManager]();
}

/**
 * Returns the version of the package manager used in the workspace.
 * By default, the package manager is derived based on the lock file,
 * but it can also be passed in explicitly.
 */
export function getPackageManagerVersion(
  packageManager: PackageManager = detectPackageManager()
): string {
  return execSync(`${packageManager} --version`).toString('utf-8').trim();
}
