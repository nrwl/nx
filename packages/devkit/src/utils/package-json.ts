import { readJson, updateJson } from 'nx/src/generators/utils/json';
import { installPackagesTask } from '../tasks/install-packages-task';
import type { Tree } from 'nx/src/generators/tree';
import { GeneratorCallback } from 'nx/src/config/misc-interfaces';
import { clean, coerce, gt, satisfies } from 'semver';
import { getPackageManagerCommand } from 'nx/src/utils/package-manager';
import { execSync } from 'child_process';
import { readModulePackageJson } from 'nx/src/utils/package-json';

const NON_SEMVER_TAGS = {
  '*': 2,
  next: 1,
  latest: 0,
  previous: -1,
  legacy: -2,
};

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
  if (
    incomingVersion in NON_SEMVER_TAGS &&
    existingVersion in NON_SEMVER_TAGS
  ) {
    return NON_SEMVER_TAGS[incomingVersion] > NON_SEMVER_TAGS[existingVersion];
  }

  if (
    incomingVersion in NON_SEMVER_TAGS ||
    existingVersion in NON_SEMVER_TAGS
  ) {
    return true;
  }

  return gt(cleanSemver(incomingVersion), cleanSemver(existingVersion));
}

function updateExistingDependenciesVersion(
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
 * @returns Callback to install dependencies only if necessary, no-op otherwise
 */
export function addDependenciesToPackageJson(
  tree: Tree,
  dependencies: Record<string, string>,
  devDependencies: Record<string, string>,
  packageJsonPath: string = 'package.json'
): GeneratorCallback {
  const currentPackageJson = readJson(tree, packageJsonPath);

  let filteredDependencies = filterExistingDependencies(
    dependencies,
    currentPackageJson.devDependencies
  );
  let filteredDevDependencies = filterExistingDependencies(
    devDependencies,
    currentPackageJson.dependencies
  );

  filteredDependencies = {
    ...filteredDependencies,
    ...updateExistingDependenciesVersion(
      devDependencies,
      currentPackageJson.dependencies
    ),
  };
  filteredDevDependencies = {
    ...filteredDevDependencies,
    ...updateExistingDependenciesVersion(
      dependencies,
      currentPackageJson.devDependencies
    ),
  };

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

/**
 * @typedef EnsurePackageOptions
 * @type {object}
 * @property {boolean} dev indicate if the package is a dev dependency
 * @property {throwOnMissing} boolean throws an error when the package is missing
 */

/**
 * Ensure that dependencies and devDependencies from package.json are installed at the required versions.
 *
 * For example:
 * ```typescript
 * ensurePackage(tree, {}, { '@nrwl/jest': nxVersion })
 * ```
 * This will check that @nrwl/jest@<nxVersion> exists in devDependencies.
 * If it exists then function returns, otherwise it will install the package before continuing.
 * When running with --dryRun, the function will throw when dependencies are missing.
 *
 * @param tree the file system tree
 * @param pkg the package to check (e.g. @nrwl/jest)
 * @param requiredVersion the version or semver range to check (e.g. ~1.0.0, >=1.0.0 <2.0.0)
 * @param {EnsurePackageOptions} options
 * @returns {Promise<void>}
 */
export async function ensurePackage(
  tree: Tree,
  pkg: string,
  requiredVersion: string,
  options: {
    dev?: boolean;
    throwOnMissing?: boolean;
  } = {}
): Promise<void> {
  let version: string;

  // Read package and version from root package.json file.
  const dev = options.dev ?? true;
  const throwOnMissing = options.throwOnMissing ?? !!process.env.NX_DRY_RUN; // NX_DRY_RUN is set in `packages/nx/src/command-line/generate.ts`
  const pmc = getPackageManagerCommand();

  // Try to resolve the actual version from resolved module.
  try {
    version = readModulePackageJson(pkg).packageJson.version;
  } catch {
    // ignore
  }

  // Otherwise try to read in from package.json. This is needed for E2E tests to pass.
  if (!version) {
    const packageJson = readJson(tree, 'package.json');
    const field = dev ? 'devDependencies' : 'dependencies';
    version = packageJson[field]?.[pkg];
  }

  if (!satisfies(version, requiredVersion)) {
    const installCmd = `${
      dev ? pmc.addDev : pmc.add
    } ${pkg}@${requiredVersion}`;
    if (throwOnMissing) {
      throw new Error(
        `Cannot install required package ${pkg} during a dry run. Run the generator without --dryRun, or install the package with "${installCmd}" and try again.`
      );
    } else {
      execSync(installCmd, {
        cwd: tree.root,
        stdio: [0, 1, 2],
      });
    }
  }
}
