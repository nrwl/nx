import { existsSync } from 'fs';
import { Module } from 'module';
import {
  type GeneratorCallback,
  output,
  readJson,
  readJsonFile,
  type Tree,
  updateJson,
  workspaceRoot,
} from 'nx/src/devkit-exports';
import { installPackageToTmp } from 'nx/src/devkit-internals';
import type { PackageJson } from 'nx/src/utils/package-json';
import { join, resolve } from 'path';
import { clean, coerce, gt } from 'semver';
import { installPackagesTask } from '../tasks/install-packages-task';
import {
  getCatalogDependenciesFromPackageJson,
  getCatalogManager,
} from './catalog';

const UNIDENTIFIED_VERSION = 'UNIDENTIFIED_VERSION';
const NON_SEMVER_TAGS = {
  '*': 2,
  [UNIDENTIFIED_VERSION]: 2,
  next: 1,
  latest: 0,
  previous: -1,
  legacy: -2,
};

/**
 * Get the resolved version of a dependency from package.json.
 *
 * Retrieves a package version and automatically resolves PNPM catalog references
 * (e.g., "catalog:default") to their actual version strings. Searches `dependencies`
 * first, then falls back to `devDependencies`.
 *
 * **Tree-based usage** (generators and migrations):
 * Use when you have a `Tree` object, which is typical in Nx generators and migrations.
 *
 * **Filesystem-based usage** (CLI commands and scripts):
 * Use when reading directly from the filesystem without a `Tree` object.
 *
 * @example
 * ```typescript
 * // Tree-based - from root package.json
 * const reactVersion = getDependencyVersionFromPackageJson(tree, 'react');
 * // Returns: "^18.0.0" (resolves "catalog:default" if present)
 *
 * // Tree-based - from specific package.json
 * const version = getDependencyVersionFromPackageJson(
 *   tree,
 *   '@my/lib',
 *   'packages/my-lib/package.json'
 * );
 *
 * // Tree-based - with pre-loaded package.json
 * const packageJson = readJson(tree, 'package.json');
 * const version = getDependencyVersionFromPackageJson(tree, 'react', packageJson);
 * ```
 *
 * @example
 * ```typescript
 * // Filesystem-based - from current directory
 * const reactVersion = getDependencyVersionFromPackageJson('react');
 *
 * // Filesystem-based - with workspace root
 * const version = getDependencyVersionFromPackageJson('react', '/path/to/workspace');
 *
 * // Filesystem-based - with specific package.json
 * const version = getDependencyVersionFromPackageJson(
 *   'react',
 *   '/path/to/workspace',
 *   'apps/my-app/package.json'
 * );
 * ```
 *
 * @returns The resolved version string, or `null` if the package is not found in either dependencies or devDependencies
 */
export function getDependencyVersionFromPackageJson(
  tree: Tree,
  packageName: string,
  packageJsonPath?: string
): string | null;
export function getDependencyVersionFromPackageJson(
  tree: Tree,
  packageName: string,
  packageJson?: PackageJson
): string | null;
export function getDependencyVersionFromPackageJson(
  packageName: string,
  workspaceRootPath?: string,
  packageJsonPath?: string
): string | null;
export function getDependencyVersionFromPackageJson(
  packageName: string,
  workspaceRootPath?: string,
  packageJson?: PackageJson
): string | null;
export function getDependencyVersionFromPackageJson(
  treeOrPackageName: Tree | string,
  packageNameOrRoot?: string,
  packageJsonPathOrObjectOrRoot?: string | PackageJson
): string | null {
  if (typeof treeOrPackageName !== 'string') {
    return getDependencyVersionFromPackageJsonFromTree(
      treeOrPackageName,
      packageNameOrRoot!,
      packageJsonPathOrObjectOrRoot
    );
  } else {
    return getDependencyVersionFromPackageJsonFromFileSystem(
      treeOrPackageName,
      packageNameOrRoot,
      packageJsonPathOrObjectOrRoot
    );
  }
}

/**
 * Tree-based implementation for getDependencyVersionFromPackageJson
 */
function getDependencyVersionFromPackageJsonFromTree(
  tree: Tree,
  packageName: string,
  packageJsonPathOrObject: string | PackageJson = 'package.json'
): string | null {
  let packageJson: PackageJson;
  if (typeof packageJsonPathOrObject === 'object') {
    packageJson = packageJsonPathOrObject;
  } else if (tree.exists(packageJsonPathOrObject)) {
    packageJson = readJson(tree, packageJsonPathOrObject);
  } else {
    return null;
  }

  const manager = getCatalogManager(tree.root);

  let version =
    packageJson.dependencies?.[packageName] ??
    packageJson.devDependencies?.[packageName] ??
    null;

  // Resolve catalog reference if needed
  if (version && manager.isCatalogReference(version)) {
    version = manager.resolveCatalogReference(tree, packageName, version);
  }

  return version;
}

/**
 * Filesystem-based implementation for getDependencyVersionFromPackageJson
 */
function getDependencyVersionFromPackageJsonFromFileSystem(
  packageName: string,
  root: string = workspaceRoot,
  packageJsonPathOrObject: string | PackageJson = 'package.json'
): string | null {
  let packageJson: PackageJson;
  if (typeof packageJsonPathOrObject === 'object') {
    packageJson = packageJsonPathOrObject;
  } else {
    const packageJsonPath = resolve(root, packageJsonPathOrObject);
    if (existsSync(packageJsonPath)) {
      packageJson = readJsonFile(packageJsonPath);
    } else {
      return null;
    }
  }

  const manager = getCatalogManager(root);

  let version =
    packageJson.dependencies?.[packageName] ??
    packageJson.devDependencies?.[packageName] ??
    null;

  // Resolve catalog reference if needed
  if (version && manager.isCatalogReference(version)) {
    version = manager.resolveCatalogReference(packageName, version, root);
  }

  return version;
}

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

function cleanSemver(tree: Tree, version: string, packageName: string) {
  const manager = getCatalogManager(tree.root);
  if (manager.isCatalogReference(version)) {
    const resolvedVersion = manager.resolveCatalogReference(
      tree,
      packageName,
      version
    );
    if (!resolvedVersion) {
      throw new Error(
        `Failed to resolve catalog reference '${version}' for package '${packageName}'`
      );
    }
    return clean(resolvedVersion) ?? coerce(resolvedVersion);
  }
  return clean(version) ?? coerce(version);
}

function isIncomingVersionGreater(
  tree: Tree,
  incomingVersion: string,
  existingVersion: string,
  packageName: string
) {
  // the existing version might be a catalog reference, so we need to resolve
  // it if that's the case
  let resolvedExistingVersion = existingVersion;
  const manager = getCatalogManager(tree.root);
  if (manager.isCatalogReference(existingVersion)) {
    if (!manager.supportsCatalogs()) {
      // If catalog is unsupported, we assume the incoming version is newer
      return true;
    }

    const resolved = manager.resolveCatalogReference(
      tree,
      packageName,
      existingVersion
    );
    if (!resolved) {
      // catalog is supported, but failed to resolve, we throw an error
      throw new Error(
        `Failed to resolve catalog reference '${existingVersion}' for package '${packageName}'`
      );
    }
    resolvedExistingVersion = resolved;
  }

  // if version is in the format of "latest", "next" or similar - keep it, otherwise try to parse it
  const incomingVersionCompareBy =
    incomingVersion in NON_SEMVER_TAGS
      ? incomingVersion
      : cleanSemver(tree, incomingVersion, packageName)?.toString() ??
        UNIDENTIFIED_VERSION;
  const existingVersionCompareBy =
    resolvedExistingVersion in NON_SEMVER_TAGS
      ? resolvedExistingVersion
      : cleanSemver(tree, resolvedExistingVersion, packageName)?.toString() ??
        UNIDENTIFIED_VERSION;

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

  return gt(
    cleanSemver(tree, incomingVersion, packageName),
    cleanSemver(tree, resolvedExistingVersion, packageName)
  );
}

function updateExistingAltDependenciesVersion(
  tree: Tree,
  dependencies: Record<string, string>,
  existingAltDependencies: Record<string, string>,
  workspaceRootPath: string
) {
  return Object.keys(existingAltDependencies || {})
    .filter((d) => {
      if (!dependencies[d]) {
        return false;
      }

      const incomingVersion = dependencies[d];
      const existingVersion = existingAltDependencies[d];
      return isIncomingVersionGreater(
        tree,
        incomingVersion,
        existingVersion,
        d
      );
    })
    .reduce((acc, d) => ({ ...acc, [d]: dependencies[d] }), {});
}

function updateExistingDependenciesVersion(
  tree: Tree,
  dependencies: Record<string, string>,
  existingDependencies: Record<string, string> = {},
  workspaceRootPath: string
) {
  return Object.keys(dependencies)
    .filter((d) => {
      if (!existingDependencies[d]) {
        return true;
      }

      const incomingVersion = dependencies[d];
      const existingVersion = existingDependencies[d];

      return isIncomingVersionGreater(
        tree,
        incomingVersion,
        existingVersion,
        d
      );
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
      tree,
      filteredDependencies,
      currentPackageJson.dependencies,
      tree.root
    ),
    ...updateExistingAltDependenciesVersion(
      tree,
      devDependencies,
      currentPackageJson.dependencies,
      tree.root
    ),
  };
  filteredDevDependencies = {
    ...updateExistingDependenciesVersion(
      tree,
      filteredDevDependencies,
      currentPackageJson.devDependencies,
      tree.root
    ),
    ...updateExistingAltDependenciesVersion(
      tree,
      dependencies,
      currentPackageJson.devDependencies,
      tree.root
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
      tree,
      filteredDependencies,
      currentPackageJson.dependencies,
      tree.root
    );
    filteredDevDependencies = removeLowerVersions(
      tree,
      filteredDevDependencies,
      currentPackageJson.devDependencies,
      tree.root
    );
  }

  if (
    requiresAddingOfPackages(
      tree,
      currentPackageJson,
      filteredDependencies,
      filteredDevDependencies,
      tree.root
    )
  ) {
    const { catalogUpdates, directDependencies, directDevDependencies } =
      splitDependenciesByCatalogType(
        tree,
        filteredDependencies,
        filteredDevDependencies,
        packageJsonPath
      );
    writeCatalogDependencies(tree, catalogUpdates);
    writeDirectDependencies(
      tree,
      packageJsonPath,
      directDependencies,
      directDevDependencies
    );

    return (): void => {
      installPackagesTask(tree);
    };
  }
  return () => {};
}

interface DependencySplit {
  catalogUpdates: Array<{
    packageName: string;
    version: string;
    catalogName?: string;
  }>;
  directDependencies: Record<string, string>;
  directDevDependencies: Record<string, string>;
}

function splitDependenciesByCatalogType(
  tree: Tree,
  filteredDependencies: Record<string, string>,
  filteredDevDependencies: Record<string, string>,
  packageJsonPath: string
): DependencySplit {
  const allFilteredUpdates = {
    ...filteredDependencies,
    ...filteredDevDependencies,
  };
  const catalogUpdates: Array<{
    packageName: string;
    version: string;
    catalogName?: string;
  }> = [];
  let directDependencies = { ...filteredDependencies };
  let directDevDependencies = { ...filteredDevDependencies };

  const manager = getCatalogManager(tree.root);
  const existingCatalogDeps = getCatalogDependenciesFromPackageJson(
    tree,
    packageJsonPath,
    manager
  );
  if (!existingCatalogDeps.size) {
    return {
      catalogUpdates: [],
      directDependencies: filteredDependencies,
      directDevDependencies: filteredDevDependencies,
    };
  }

  const supportsCatalogs = manager.supportsCatalogs();

  // Check filtered results for catalog references or existing catalog dependencies
  for (const [packageName, version] of Object.entries(allFilteredUpdates)) {
    if (!existingCatalogDeps.has(packageName)) {
      continue;
    }

    let shouldUseCatalog = false;
    let catalogName: string | undefined;

    if (!supportsCatalogs) {
      // we're trying to update the version of a package that has a catalog reference
      // but Nx does not support catalogs for this package manager, we warn the user
      // and update the dependencies directly to package.json to keep the existing
      // behavior
      output.warn({
        title: 'Nx does not support catalogs for this package manager',
        bodyLines: [
          'Dependencies will be added directly to package.json and might override catalog dependencies.',
        ],
      });

      // bail out early since we'll add the dependencies directly to package.json
      return {
        catalogUpdates: [],
        directDependencies: filteredDependencies,
        directDevDependencies: filteredDevDependencies,
      };
    }

    catalogName = existingCatalogDeps.get(packageName)!;
    const catalogRef = catalogName ? `catalog:${catalogName}` : 'catalog:';

    try {
      const manager = getCatalogManager(tree.root);
      const { isValid, error } = manager.validateCatalogReference(
        tree,
        packageName,
        catalogRef
      );

      if (isValid) {
        shouldUseCatalog = true;
      } else {
        output.error({
          title: 'Invalid catalog reference',
          bodyLines: [
            `Invalid catalog reference "${catalogRef}" for package "${packageName}".`,
            ...(error?.message ? [error.message] : []),
            ...(error?.suggestions || []),
          ],
        });
        throw new Error(
          `Could not update "${packageName}" to version "${version}". See above for more details.`
        );
      }
    } catch (error) {
      output.error({
        title: 'Could not update catalog dependency',
        bodyLines: [
          `Unexpected error while updating catalog reference "${catalogRef}" for package "${packageName}".`,
          ...(error?.message ? [error.message] : []),
          ...(error?.stack ? [error.stack] : []),
        ],
      });
      throw new Error(
        `Could not update "${packageName}" to version "${version}". See above for more details.`
      );
    }

    if (shouldUseCatalog) {
      catalogUpdates.push({ packageName, version, catalogName });

      // Remove from direct updates since this will be handled via catalog
      delete directDependencies[packageName];
      delete directDevDependencies[packageName];
    }
  }

  return { catalogUpdates, directDependencies, directDevDependencies };
}

function writeCatalogDependencies(
  tree: Tree,
  catalogUpdates: Array<{
    packageName: string;
    version: string;
    catalogName?: string;
  }>
): void {
  if (!catalogUpdates.length) {
    return;
  }

  const manager = getCatalogManager(tree.root);
  manager.updateCatalogVersions(tree, catalogUpdates);
}

function writeDirectDependencies(
  tree: Tree,
  packageJsonPath: string,
  dependencies: Record<string, string>,
  devDependencies: Record<string, string>
): void {
  updateJson(tree, packageJsonPath, (json) => {
    json.dependencies = {
      ...(json.dependencies || {}),
      ...dependencies,
    };

    json.devDependencies = {
      ...(json.devDependencies || {}),
      ...devDependencies,
    };

    json.dependencies = sortObjectByKeys(json.dependencies);
    json.devDependencies = sortObjectByKeys(json.devDependencies);

    return json;
  });
}

/**
 * @returns The the incoming dependencies that are higher than the existing verions
 **/
function removeLowerVersions(
  tree: Tree,
  incomingDeps: Record<string, string>,
  existingDeps: Record<string, string>,
  workspaceRootPath: string
) {
  return Object.keys(incomingDeps).reduce((acc, d) => {
    if (
      !existingDeps?.[d] ||
      isIncomingVersionGreater(tree, incomingDeps[d], existingDeps[d], d)
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
      if (json.dependencies) {
        for (const dep of dependencies) {
          delete json.dependencies[dep];
        }
        json.dependencies = sortObjectByKeys(json.dependencies);
      }
      if (json.devDependencies) {
        for (const devDep of devDependencies) {
          delete json.devDependencies[devDep];
        }
        json.devDependencies = sortObjectByKeys(json.devDependencies);
      }
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
function requiresAddingOfPackages(
  tree: Tree,
  packageJsonFile: PackageJson,
  deps: Record<string, string>,
  devDeps: Record<string, string>,
  workspaceRootPath: string
): boolean {
  let needsDepsUpdate = false;
  let needsDevDepsUpdate = false;

  packageJsonFile.dependencies = packageJsonFile.dependencies || {};
  packageJsonFile.devDependencies = packageJsonFile.devDependencies || {};

  if (Object.keys(deps).length > 0) {
    needsDepsUpdate = Object.keys(deps).some((entry) => {
      const incomingVersion = deps[entry];
      if (packageJsonFile.dependencies[entry]) {
        const existingVersion = packageJsonFile.dependencies[entry];
        return isIncomingVersionGreater(
          tree,
          incomingVersion,
          existingVersion,
          entry
        );
      }

      if (packageJsonFile.devDependencies[entry]) {
        const existingVersion = packageJsonFile.devDependencies[entry];
        return isIncomingVersionGreater(
          tree,
          incomingVersion,
          existingVersion,
          entry
        );
      }

      return true;
    });
  }

  if (Object.keys(devDeps).length > 0) {
    needsDevDepsUpdate = Object.keys(devDeps).some((entry) => {
      const incomingVersion = devDeps[entry];
      if (packageJsonFile.devDependencies[entry]) {
        const existingVersion = packageJsonFile.devDependencies[entry];
        return isIncomingVersionGreater(
          tree,
          incomingVersion,
          existingVersion,
          entry
        );
      }
      if (packageJsonFile.dependencies[entry]) {
        const existingVersion = packageJsonFile.dependencies[entry];

        return isIncomingVersionGreater(
          tree,
          incomingVersion,
          existingVersion,
          entry
        );
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

  const { tempDir } = installPackageToTmp(pkg, requiredVersion);

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

function getInstalledPackageModuleVersion(pkg: string): string {
  return require(join(pkg, 'package.json')).version;
}

/**
 * @description The version of Nx used by the workspace. Returns null if no version is found.
 */
export const NX_VERSION = getInstalledPackageModuleVersion('nx');
