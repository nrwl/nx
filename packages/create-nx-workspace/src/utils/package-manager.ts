import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, sep } from 'node:path';

/*
 * Because we don't want to depend on @nx/workspace (to speed up the workspace creation)
 * we duplicate the helper functions from @nx/workspace in this file.
 */

export const packageManagerList = ['pnpm', 'yarn', 'npm', 'bun'] as const;

export type PackageManager = (typeof packageManagerList)[number];

export function detectPackageManager(dir: string = ''): PackageManager {
  return existsSync(join(dir, 'bun.lockb')) || existsSync(join(dir, 'bun.lock'))
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
      // bun doesn't current support programmatically reading config https://github.com/oven-sh/bun/issues/7140
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
    case 'pnpm':
      // pnpm doesn't support "workspaces" in package.json
      convertToWorkspaceYaml(root);
      convertStarToWorkspaceProtocol(root);
      break;
    case 'yarn':
      if (+pmMajor >= 2) {
        writeFileSync(
          join(root, '.yarnrc.yml'),
          'nodeLinker: node-modules\nenableScripts: false'
        );
        // avoids errors when using nested yarn projects
        writeFileSync(join(root, 'yarn.lock'), '');
      }
      convertStarToWorkspaceProtocol(root);
      break;
    case 'bun':
      convertStarToWorkspaceProtocol(root);
      break;
    // npm handles "*" natively, no conversion needed
  }
}

/**
 * Converts an array of workspace globs to pnpm-workspace.yaml content.
 */
export function workspacesToPnpmYaml(workspaces: string[]): string {
  return `packages:\n${workspaces.map((p) => `  - '${p}'`).join('\n')}\n`;
}

function convertToWorkspaceYaml(root: string): void {
  const packageJsonPath = join(root, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return;
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  const workspaces: string[] | undefined = packageJson.workspaces;

  if (!workspaces || workspaces.length === 0) {
    return;
  }

  writeFileSync(
    join(root, 'pnpm-workspace.yaml'),
    workspacesToPnpmYaml(workspaces)
  );

  delete packageJson.workspaces;
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
}

/**
 * Converts "*" dependencies to "workspace:*" in all workspace package.json files.
 * This is needed for pnpm, yarn, and bun to properly symlink workspace packages.
 */
export function convertStarToWorkspaceProtocol(root: string): void {
  for (const pkgJsonPath of findAllWorkspacePackageJsons(root)) {
    try {
      const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
      let updated = false;

      for (const deps of [pkgJson.dependencies, pkgJson.devDependencies]) {
        if (!deps) continue;
        for (const [dep, version] of Object.entries(deps)) {
          if (version === '*') {
            deps[dep] = 'workspace:*';
            updated = true;
          }
        }
      }

      if (updated) {
        writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n');
      }
    } catch {
      // Skip invalid package.json files
    }
  }
}

export function findAllWorkspacePackageJsons(
  root: string,
  maxDepth: number = 2
): string[] {
  const results: string[] = [];

  for (const dir of ['packages', 'libs', 'apps']) {
    const fullPath = join(root, dir);
    if (existsSync(fullPath)) {
      findPackageJsonsRecursive(fullPath, 1, maxDepth, results);
    }
  }

  return results;
}

function findPackageJsonsRecursive(
  dir: string,
  currentDepth: number,
  maxDepth: number,
  results: string[]
): void {
  if (currentDepth > maxDepth) {
    return;
  }

  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const entryPath = join(dir, entry.name);
      const pkgJsonPath = join(entryPath, 'package.json');

      if (existsSync(pkgJsonPath)) {
        results.push(pkgJsonPath);
      }

      if (currentDepth < maxDepth) {
        findPackageJsonsRecursive(
          entryPath,
          currentDepth + 1,
          maxDepth,
          results
        );
      }
    }
  } catch {
    // Skip unreadable directories
  }
}

export function findWorkspacePackages(root: string): string[] {
  const packages: string[] = [];
  const packageJsonPaths = findAllWorkspacePackageJsons(root);

  for (const pkgJsonPath of packageJsonPaths) {
    try {
      const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
      if (pkgJson.name) {
        packages.push(pkgJson.name);
      }
    } catch {
      // Skip invalid package.json files
    }
  }

  return packages.sort();
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
    windowsHide: false,
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
 * - bunx returns 'bun'
 *
 * Default to 'npm'
 */
export function detectInvokedPackageManager(): PackageManager {
  if (process.env.npm_config_user_agent) {
    for (const pm of packageManagerList) {
      if (process.env.npm_config_user_agent.startsWith(`${pm}/`)) {
        return pm;
      }
    }
  }

  if (process.env.npm_execpath) {
    for (const pm of packageManagerList) {
      if (process.env.npm_execpath.split(sep).includes(pm)) {
        return pm;
      }
    }
  }
  return 'npm';
}
