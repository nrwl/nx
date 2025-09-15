import { dirSync } from 'tmp';
import {
  createTempNpmDirectory,
  detectPackageManager,
  getPackageManagerCommand,
  getPackageManagerVersion,
  PackageManager,
} from './package-manager';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { workspaceRoot } from './workspace-root';
import Module = require('module');
import { Tree } from '../generators/tree';
import { ensurePackageHasProvenance } from './provenance';
import { execSync } from 'child_process';

const packageMapCache = new Map<string, any>();

/**
 * @typedef EnsurePackageOptions
 * @type {object}
 * @property {boolean} dev indicate if the package is a dev dependency
 * @property {throwOnMissing} boolean throws an error when the package is missing
 */

/**
 * @deprecated Use the other function signature without a Tree
 *
 * Use a package that has not been installed as a dependency.
 *
 * For example:
 * ```typescript
 * ensurePackage(tree, '@nx/jest', nxVersion)
 * ```
 * This install the @nx/jest@<nxVersion> and return the module
 * When running with --dryRun, the function will throw when dependencies are missing.
 * Returns null for ESM dependencies. Import them with a dynamic import instead.
 *
 * @param tree the file system tree
 * @param pkg the package to check (e.g. @nx/jest)
 * @param requiredVersion the version or semver range to check (e.g. ~1.0.0, >=1.0.0 <2.0.0)
 * @param {EnsurePackageOptions} options?
 */
export function ensurePackage(
  tree: Tree,
  pkg: string,
  requiredVersion: string,
  options?: { dev?: boolean; throwOnMissing?: boolean }
): void;

/**
 * Ensure that dependencies and devDependencies from package.json are installed at the required versions.
 * Returns null for ESM dependencies. Import them with a dynamic import instead.
 *
 * For example:
 * ```typescript
 * ensurePackage('@nx/jest', nxVersion)
 * ```
 *
 * @param pkg the package to install and require
 * @param version the version to install if the package doesn't exist already
 */
export function ensurePackage<T extends any = any>(
  pkg: string,
  version: string
): T;
export function ensurePackage<T extends any = any>(
  pkgOrTree: string | Tree,
  requiredVersionOrPackage: string,
  maybeRequiredVersion?: string,
  _?: never
): T {
  let pkg: string;
  let requiredVersion: string;
  if (typeof pkgOrTree === 'string') {
    pkg = pkgOrTree;
    requiredVersion = requiredVersionOrPackage;
  } else {
    // Old Signature
    pkg = requiredVersionOrPackage;
    requiredVersion = maybeRequiredVersion;
  }

  if (packageMapCache.has(pkg)) {
    return packageMapCache.get(pkg) as T;
  }

  try {
    return require(pkg);
  } catch (e) {
    if (e.code === 'ERR_REQUIRE_ESM') {
      // The package is installed, but is an ESM package.
      // The consumer of this function can import it as needed.
      return null;
    } else if (e.code !== 'MODULE_NOT_FOUND') {
      throw e;
    }
  }

  if (process.env.NX_DRY_RUN && process.env.NX_DRY_RUN !== 'false') {
    throw new Error(
      'NOTE: This generator does not support --dry-run. If you are running this in Nx Console, it should execute fine once you hit the "Generate" button.\n'
    );
  }

  const { dir: tempDir } = createTempNpmDirectory?.() ?? {
    dir: dirSync().name,
  };

  console.log(`Fetching ${pkg}...`);
  const packageManager = detectPackageManager();
  const isVerbose = process.env.NX_VERBOSE_LOGGING === 'true';
  generatePackageManagerFiles(tempDir, packageManager);
  const preInstallCommand = getPackageManagerCommand(packageManager).preInstall;
  if (preInstallCommand) {
    // ensure package.json and repo in tmp folder is set to a proper package manager state
    execSync(preInstallCommand, {
      cwd: tempDir,
      stdio: isVerbose ? 'inherit' : 'ignore',
      windowsHide: false,
    });
  }
  const pmCommands = getPackageManagerCommand(packageManager);
  let addCommand = pmCommands.addDev;
  if (packageManager === 'pnpm') {
    addCommand = 'pnpm add -D'; // we need to ensure that we are not using workspace command
  }

  execSync(
    `${addCommand} ${pkg}@${requiredVersion} ${
      pmCommands.ignoreScriptsFlag ?? ''
    }`,
    {
      cwd: tempDir,
      stdio: isVerbose ? 'inherit' : 'ignore',
      windowsHide: false,
    }
  );

  addToNodePath(join(workspaceRoot, 'node_modules'));
  addToNodePath(join(tempDir, 'node_modules'));

  // Re-initialize the added paths into require
  (Module as any)._initPaths();

  try {
    const result = require(require.resolve(pkg, {
      paths: [tempDir],
    }));

    packageMapCache.set(pkg, result);

    return result;
  } catch (e) {
    if (e.code === 'ERR_REQUIRE_ESM') {
      // The package is installed, but is an ESM package.
      // The consumer of this function can import it as needed.
      packageMapCache.set(pkg, null);
      return null;
    }
    throw e;
  }
}

export async function ensurePackageAsync<T extends any = any>(
  pkg: string,
  version: string
): Promise<T> {
  await ensurePackageHasProvenance(pkg, version);
  return await ensurePackage(pkg, version);
}

/**
 * Generates necessary files needed for the package manager to work
 * and for the node_modules to be accessible.
 */
function generatePackageManagerFiles(
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

function addToNodePath(dir: string) {
  // NODE_PATH is a delimited list of paths.
  // The delimiter is different for windows.
  const delimiter = require('os').platform() === 'win32' ? ';' : ':';

  const paths = process.env.NODE_PATH
    ? process.env.NODE_PATH.split(delimiter)
    : [];

  // The path is already in the node path
  if (paths.includes(dir)) {
    return;
  }

  // Add the tmp path
  paths.push(dir);

  // Update the env variable.
  process.env.NODE_PATH = paths.join(delimiter);
}
