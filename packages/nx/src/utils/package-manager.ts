import { exec, execSync } from 'child_process';
import { copyFileSync, existsSync } from 'fs';
import { remove } from 'fs-extra';
import { dirname, join } from 'path';
import { dirSync } from 'tmp';
import { promisify } from 'util';
import { readJsonFile, writeJsonFile } from './fileutils';
import { PackageJson } from './package-json';

const execAsync = promisify(exec);

export type PackageManager = 'yarn' | 'pnpm' | 'npm';

export interface PackageManagerCommands {
  install: string;
  add: string;
  addDev: string;
  addGlobal: string;
  rm: string;
  exec: string;
  list: string;
  pack: string;
  view: string;
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
      add: 'yarn add -W',
      addDev: 'yarn add -D -W',
      addGlobal: 'yarn global add',
      rm: 'yarn remove',
      exec: 'yarn',
      run: (script: string, args: string) => `yarn ${script} ${args}`,
      list: 'yarn list',
      pack: 'npm pack',
      view: 'npm view',
    }),
    pnpm: () => {
      const [major, minor] = getPackageManagerVersion('pnpm').split('.');
      let useExec = false;
      if (+major >= 6 && +minor >= 13) {
        useExec = true;
      }
      return {
        install: 'pnpm install --no-frozen-lockfile', // explicitly disable in case of CI
        add: 'pnpm add',
        addDev: 'pnpm add -D',
        addGlobal: 'pnpm add -g',
        rm: 'pnpm rm',
        exec: useExec ? 'pnpm exec' : 'pnpx',
        run: (script: string, args: string) => `pnpm run ${script} -- ${args}`,
        list: 'pnpm ls --depth 100',
        pack: 'pnpm pack',
        view: 'pnpm view',
      };
    },
    npm: () => {
      process.env.npm_config_legacy_peer_deps ??= 'true';

      return {
        install: 'npm install',
        add: 'npm install',
        addDev: 'npm install -D',
        addGlobal: 'npm install -g',
        rm: 'npm rm',
        exec: 'npx',
        run: (script: string, args: string) => `npm run ${script} -- ${args}`,
        list: 'npm ls',
        pack: 'npm pack',
        view: 'npm view',
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

/**
 * Checks for a project level npmrc file by crawling up the file tree until
 * hitting a package.json file, as this is how npm finds them as well.
 */
export function checkForNPMRC(
  directory: string = process.cwd()
): string | null {
  while (!existsSync(join(directory, 'package.json'))) {
    directory = dirname(directory);
  }
  const path = join(directory, '.npmrc');
  return existsSync(path) ? path : null;
}

export function createTempNpmDirectory(): string {
  const dir = dirSync().name;

  // A package.json is needed for pnpm pack and for .npmrc to resolve
  writeJsonFile(`${dir}/package.json`, {});
  const npmrc = checkForNPMRC();
  if (npmrc) {
    // Copy npmrc if it exists, so that npm still follows it.
    copyFileSync(npmrc, `${dir}/.npmrc`);
  }

  return dir;
}

/**
 * Returns the resolved version for a given package and version tag using the
 * NPM registry (when using Yarn it will fall back to NPM to fetch the info).
 */
export async function resolvePackageVersionUsingRegistry(
  packageName: string,
  version: string
): Promise<string> {
  try {
    const pmc = getPackageManagerCommand();

    const { stdout } = await execAsync(
      `${pmc.view} ${packageName}@${version} version`
    );

    const result = stdout.trim();

    if (!result) {
      throw new Error(`Unable to resolve version ${packageName}@${version}.`);
    }

    // get the last line of the output, strip the package version and quotes
    const resolvedVersion = result
      .split('\n')
      .pop()
      .split(' ')
      .pop()
      .replace(/'/g, '');

    return resolvedVersion;
  } catch {
    throw new Error(`Unable to resolve version ${packageName}@${version}.`);
  }
}

/**
 * Return the resolved version for a given package and version tag using by
 * installing it in a temporary directory and fetching the version from the
 * package.json.
 */
export async function resolvePackageVersionUsingInstallation(
  packageName: string,
  version: string
): Promise<string> {
  const dir = createTempNpmDirectory();

  try {
    const pmc = getPackageManagerCommand();
    await execAsync(`${pmc.add} ${packageName}@${version}`, { cwd: dir });

    const packageJsonPath = require.resolve(`${packageName}/package.json`, {
      paths: [dir],
    });

    return readJsonFile<PackageJson>(packageJsonPath).version;
  } finally {
    try {
      await remove(dir);
    } catch {
      // It's okay if this fails, the OS will clean it up eventually
    }
  }
}
