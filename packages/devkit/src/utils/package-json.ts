import { readJson, updateJson } from 'nx/src/generators/utils/json';
import { installPackagesTask } from '../tasks/install-packages-task';
import type { Tree } from 'nx/src/generators/tree';
import { GeneratorCallback } from 'nx/src/config/misc-interfaces';
import { coerce, gt } from 'semver';

const NON_SEMVER_TAGS = {
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

      if (
        incomingVersion in NON_SEMVER_TAGS &&
        existingVersion in NON_SEMVER_TAGS
      ) {
        return (
          NON_SEMVER_TAGS[incomingVersion] > NON_SEMVER_TAGS[existingVersion]
        );
      }

      if (
        incomingVersion in NON_SEMVER_TAGS ||
        existingVersion in NON_SEMVER_TAGS
      ) {
        return true;
      }

      return gt(coerce(incomingVersion), coerce(existingVersion));
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
    needsDepsUpdate =
      Object.keys(deps).some((entry) => !packageJsonFile.dependencies[entry]) ||
      Object.keys(deps).some(
        (entry) => !packageJsonFile.devDependencies[entry]
      );
  }

  if (Object.keys(devDeps).length > 0) {
    needsDevDepsUpdate =
      Object.keys(devDeps).some(
        (entry) => !packageJsonFile.devDependencies[entry]
      ) ||
      Object.keys(devDeps).some(
        (entry) => !packageJsonFile.dependencies[entry]
      );
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
