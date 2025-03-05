import { execSync } from 'child_process';
import { Module } from 'module';
import { clean, coerce, gt } from 'semver';

import { installPackagesTask } from '../tasks/install-packages-task';
import { dirSync } from 'tmp';
import { join } from 'path';
import {
  detectPackageManager,
  GeneratorCallback,
  getPackageManagerCommand,
  getPackageManagerVersion,
  PackageManager,
  readJson,
  Tree,
  updateJson,
  workspaceRoot,
} from 'nx/src/devkit-exports';
import { createTempNpmDirectory } from 'nx/src/devkit-internals';
import { writeFileSync } from 'fs';

const UNIDENTIFIED_VERSION = 'UNIDENTIFIED_VERSION';
const NON_SEMVER_TAGS = {
  '*': 2,
  [UNIDENTIFIED_VERSION]: 2,
  next: 1,
  latest: 0,
  previous: -1,
  legacy: -2,
};

const ERR_REQUIRE_ESM = 'ERR_REQUIRE_ESM';
export const ERR_MODULE_NOT_FOUND = 'MODULE_NOT_FOUND';

function filterExistingDependencies(
  dependencies: Record<string, string>,
  existingAltDependencies: Record<string, string>
) {
  if (!existingAltDependencies) {
    return dependencies;
  }

  return Object.keys(dependencies ?? {})
    .filter((d) => !existingAltDependencies[d])
    .reduce((acc, d) => ({ ...acc, [d]: dependencies[d] }), {});
}

function cleanSemver(version: string) {
  return clean(version) ?? coerce(version);
}

function isIncomingVersionGreater(
  incomingVersion: string,
  existingVersion: string
) {
  // if version is in the format of "latest", "next" or similar - keep it, otherwise try to parse it
  const incomingVersionCompareBy =
    incomingVersion in NON_SEMVER_TAGS
      ? incomingVersion
      : cleanSemver(incomingVersion)?.toString() ?? UNIDENTIFIED_VERSION;
  const existingVersionCompareBy =
    existingVersion in NON_SEMVER_TAGS
      ? existingVersion
      : cleanSemver(existingVersion)?.toString() ?? UNIDENTIFIED_VERSION;

  if (
    incomingVersionCompareBy in NON_SEMVER_TAGS &&
    existingVersionCompareBy in NON_SEMVER_TAGS
  ) {
    return (
      NON_SEMVER_TAGS[incomingVersionCompareBy] >
      NON_SEMVER_TAGS[existingVersionCompareBy]
    );
  }

  if (
    incomingVersionCompareBy in NON_SEMVER_TAGS ||
    existingVersionCompareBy in NON_SEMVER_TAGS
  ) {
    return true;
  }

  return gt(cleanSemver(incomingVersion), cleanSemver(existingVersion));
}

function updateExistingAltDependenciesVersion(
  dependencies: Record<string, string>,
  existingAltDependencies: Record<string, string>
) {
  return Object.keys(existingAltDependencies || {})
    .filter((d) => {
      if (!dependencies[d]) {
        return false;
      }

      const incomingVersion = dependencies[d];
      const existingVersion = existingAltDependencies[d];
      return isIncomingVersionGreater(incomingVersion, existingVersion);
    })
    .reduce((acc, d) => ({ ...acc, [d]: dependencies[d] }), {});
}

function updateExistingDependenciesVersion(
  dependencies: Record<string, string>,
  existingDependencies: Record<string, string> = {}
) {
  return Object.keys(dependencies)
    .filter((d) => {
      if (!existingDependencies[d]) {
        return true;
      }

      const incomingVersion = dependencies[d];
      const existingVersion = existingDependencies[d];

      return isIncomingVersionGreater(incomingVersion, existingVersion);
    })
    .reduce((acc, d) => ({ ...acc, [d]: dependencies[d] }), {});
}

/**
 * Add Dependencies and Dev Dependencies to package.json
 *
 * For example:
 * ```typescript
 * addDependenciesToPackageJson(tree, { react: 'latest' }, { jest: 'latest' })
 * ```
 * This will **add** `react` and `jest` to the dependencies and devDependencies sections of package.json respectively.
 *
 * @param tree Tree representing file system to modify
 * @param dependencies Dependencies to be added to the dependencies section of package.json
 * @param devDependencies Dependencies to be added to the devDependencies section of package.json
 * @param packageJsonPath Path to package.json
 * @param keepExistingVersions If true, prevents existing dependencies from being bumped to newer versions
 * @returns Callback to install dependencies only if necessary, no-op otherwise
 */
export function addDependenciesToPackageJson(
  tree: Tree,
  dependencies: Record<string, string>,
  devDependencies: Record<string, string>,
  packageJsonPath: string = 'package.json',
  keepExistingVersions?: boolean
): GeneratorCallback {
  const currentPackageJson = readJson(tree, packageJsonPath);

  /** Dependencies to install that are not met in dev dependencies */
  let filteredDependencies = filterExistingDependencies(
    dependencies,
    currentPackageJson.devDependencies
  );
  /** Dev dependencies to install that are not met in dependencies */
  let filteredDevDependencies = filterExistingDependencies(
    devDependencies,
    currentPackageJson.dependencies
  );

  // filtered dependencies should consist of:
  // - dependencies of the same type that are not present
  // by default, filtered dependencies also include these (unless keepExistingVersions is true):
  // - dependencies of the same type that have greater version
  // - specified dependencies of the other type that have greater version and are already installed as current type
  filteredDependencies = {
    ...updateExistingDependenciesVersion(
      filteredDependencies,
      currentPackageJson.dependencies
    ),
    ...updateExistingAltDependenciesVersion(
      devDependencies,
      currentPackageJson.dependencies
    ),
  };
  filteredDevDependencies = {
    ...updateExistingDependenciesVersion(
      filteredDevDependencies,
      currentPackageJson.devDependencies
    ),
    ...updateExistingAltDependenciesVersion(
      dependencies,
      currentPackageJson.devDependencies
    ),
  };

  if (keepExistingVersions) {
    filteredDependencies = removeExistingDependencies(
      filteredDependencies,
      currentPackageJson.dependencies
    );
    filteredDevDependencies = removeExistingDependencies(
      filteredDevDependencies,
      currentPackageJson.devDependencies
    );
  } else {
    filteredDependencies = removeLowerVersions(
      filteredDependencies,
      currentPackageJson.dependencies
    );
    filteredDevDependencies = removeLowerVersions(
      filteredDevDependencies,
      currentPackageJson.devDependencies
    );
  }

  if (
    requiresAddingOfPackages(
      currentPackageJson,
      filteredDependencies,
      filteredDevDependencies
    )
  ) {
    updateJson(tree, packageJsonPath, (json) => {
      json.dependencies = {
        ...(json.dependencies || {}),
        ...filteredDependencies,
      };

      json.devDependencies = {
        ...(json.devDependencies || {}),
        ...filteredDevDependencies,
      };

      json.dependencies = sortObjectByKeys(json.dependencies);
      json.devDependencies = sortObjectByKeys(json.devDependencies);

      return json;
    });

    return (): void => {
      installPackagesTask(tree);
    };
  }
  return () => {};
}

/**
 * @returns The the incoming dependencies that are higher than the existing verions
 **/
function removeLowerVersions(
  incomingDeps: Record<string, string>,
  existingDeps: Record<string, string>
) {
  return Object.keys(incomingDeps).reduce((acc, d) => {
    if (
      !existingDeps?.[d] ||
      isIncomingVersionGreater(incomingDeps[d], existingDeps[d])
    ) {
      acc[d] = incomingDeps[d];
    }
    return acc;
  }, {});
}

function removeExistingDependencies(
  incomingDeps: Record<string, string>,
  existingDeps: Record<string, string>
): Record<string, string> {
  return Object.keys(incomingDeps).reduce((acc, d) => {
    if (!existingDeps?.[d]) {
      acc[d] = incomingDeps[d];
    }
    return acc;
  }, {});
}

/**
 * Remove Dependencies and Dev Dependencies from package.json
 *
 * For example:
 * ```typescript
 * removeDependenciesFromPackageJson(tree, ['react'], ['jest'])
 * ```
 * This will **remove** `react` and `jest` from the dependencies and devDependencies sections of package.json respectively.
 *
 * @param dependencies Dependencies to be removed from the dependencies section of package.json
 * @param devDependencies Dependencies to be removed from the devDependencies section of package.json
 * @returns Callback to uninstall dependencies only if necessary. undefined is returned if changes are not necessary.
 */
export function removeDependenciesFromPackageJson(
  tree: Tree,
  dependencies: string[],
  devDependencies: string[],
  packageJsonPath: string = 'package.json'
): GeneratorCallback {
  const currentPackageJson = readJson(tree, packageJsonPath);

  if (
    requiresRemovingOfPackages(
      currentPackageJson,
      dependencies,
      devDependencies
    )
  ) {
    updateJson(tree, packageJsonPath, (json) => {
      for (const dep of dependencies) {
        delete json.dependencies[dep];
      }
      for (const devDep of devDependencies) {
        delete json.devDependencies[devDep];
      }
      json.dependencies = sortObjectByKeys(json.dependencies);
      json.devDependencies = sortObjectByKeys(json.devDependencies);

      return json;
    });
  }
  return (): void => {
    installPackagesTask(tree);
  };
}

function sortObjectByKeys<T>(obj: T): T {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return obj;
  }
  return Object.keys(obj)
    .sort()
    .reduce((result, key) => {
      return {
        ...result,
        [key]: obj[key],
      };
    }, {}) as T;
}

/**
 * Verifies whether the given packageJson dependencies require an update
 * given the deps & devDeps passed in
 */
function requiresAddingOfPackages(packageJsonFile, deps, devDeps): boolean {
  let needsDepsUpdate = false;
  let needsDevDepsUpdate = false;

  packageJsonFile.dependencies = packageJsonFile.dependencies || {};
  packageJsonFile.devDependencies = packageJsonFile.devDependencies || {};

  if (Object.keys(deps).length > 0) {
    needsDepsUpdate = Object.keys(deps).some((entry) => {
      const incomingVersion = deps[entry];
      if (packageJsonFile.dependencies[entry]) {
        const existingVersion = packageJsonFile.dependencies[entry];
        return isIncomingVersionGreater(incomingVersion, existingVersion);
      }

      if (packageJsonFile.devDependencies[entry]) {
        const existingVersion = packageJsonFile.devDependencies[entry];
        return isIncomingVersionGreater(incomingVersion, existingVersion);
      }

      return true;
    });
  }

  if (Object.keys(devDeps).length > 0) {
    needsDevDepsUpdate = Object.keys(devDeps).some((entry) => {
      const incomingVersion = devDeps[entry];
      if (packageJsonFile.devDependencies[entry]) {
        const existingVersion = packageJsonFile.devDependencies[entry];
        return isIncomingVersionGreater(incomingVersion, existingVersion);
      }
      if (packageJsonFile.dependencies[entry]) {
        const existingVersion = packageJsonFile.dependencies[entry];

        return isIncomingVersionGreater(incomingVersion, existingVersion);
      }

      return true;
    });
  }

  return needsDepsUpdate || needsDevDepsUpdate;
}

/**
 * Verifies whether the given packageJson dependencies require an update
 * given the deps & devDeps passed in
 */
function requiresRemovingOfPackages(
  packageJsonFile,
  deps: string[],
  devDeps: string[]
): boolean {
  let needsDepsUpdate = false;
  let needsDevDepsUpdate = false;

  packageJsonFile.dependencies = packageJsonFile.dependencies || {};
  packageJsonFile.devDependencies = packageJsonFile.devDependencies || {};

  if (deps.length > 0) {
    needsDepsUpdate = deps.some((entry) => packageJsonFile.dependencies[entry]);
  }

  if (devDeps.length > 0) {
    needsDevDepsUpdate = devDeps.some(
      (entry) => packageJsonFile.devDependencies[entry]
    );
  }

  return needsDepsUpdate || needsDevDepsUpdate;
}

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
  let errorCode: string;
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
    errorCode = e.code;
    if (errorCode === ERR_REQUIRE_ESM) {
      // The package is installed, but is an ESM package.
      // The consumer of this function can import it as needed.
      return null;
    } else if (errorCode !== ERR_MODULE_NOT_FOUND) {
      throw e;
    }
  }

  if (process.env.NX_DRY_RUN && process.env.NX_DRY_RUN !== 'false') {
    throw new Error(
      `NOTE: This generator does not support --dry-run for ${pkgOrTree}. If you are running this in Nx Console, it should execute fine once you hit the "Generate" button.\n`, 
      { 'cause': errorCode }
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
  let addCommand = getPackageManagerCommand(packageManager).addDev;
  if (packageManager === 'pnpm') {
    addCommand = 'pnpm add -D'; // we need to ensure that we are not using workspace command
  }

  execSync(`${addCommand} ${pkg}@${requiredVersion}`, {
    cwd: tempDir,
    stdio: isVerbose ? 'inherit' : 'ignore',
    windowsHide: false,
  });

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
    if (e.code === ERR_REQUIRE_ESM) {
      // The package is installed, but is an ESM package.
      // The consumer of this function can import it as needed.
      packageMapCache.set(pkg, null);
      return null;
    }
    throw e;
  }
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

function getPackageVersion(pkg: string): string {
  return require(join(pkg, 'package.json')).version;
}

/**
 * @description The version of Nx used by the workspace. Returns null if no version is found.
 */
export const NX_VERSION = getPackageVersion('nx');
