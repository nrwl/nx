import { existsSync } from 'fs';
import { satisfies } from 'semver';
import { readJsonFile } from '../utils/fileutils';
import { output } from '../utils/output';
import { joinPathFragments } from '../utils/path';
import { workspaceRoot } from '../utils/workspace-root';
import { LockFileData, PackageDependency } from './utils/lock-file-type';
import { sortObject } from './utils/sorting';
import { TransitiveLookupFunctionInput } from './utils/mapping';
import { hashString, generatePrunnedHash } from './utils/hashing';

type PackageMeta = {
  path: string;
  optional?: boolean;
  dev?: boolean;
  [key: string]: any;
};

type Dependencies = Record<string, Omit<PackageDependency, 'packageMeta'>>;

type NpmDependency = {
  version: string;
  resolved: string;
  integrity: string;
  requires?: Record<string, string>;
  dependencies?: Record<string, NpmDependency>;
  dev?: boolean;
  peer?: boolean;
  devOptional?: boolean;
  optional?: boolean;
};

/**
 * Lock file version differences:
 * - v1 has only dependencies
 * - v2 has dependencies and packages for backwards compatibility
 * - v3 has only packages
 */
type NpmLockFile = {
  name?: string;
  lockfileVersion: number;
  requires?: boolean;
  packages?: Dependencies;
  dependencies?: Record<string, NpmDependency>;
};

/**
 * Parses package-lock.json file to `LockFileData` object
 *
 * @param lockFile
 * @returns
 */
export function parseNpmLockFile(lockFile: string): LockFileData {
  const { packages, dependencies, ...metadata } = JSON.parse(
    lockFile
  ) as NpmLockFile;
  return {
    dependencies: mapPackages(dependencies, packages, metadata.lockfileVersion),
    lockFileMetadata: {
      metadata,
      ...(packages && { rootPackage: packages[''] }),
    },
    hash: hashString(lockFile),
  };
}

// Maps /node_modules/@abc/def with version 1.2.3 => @abc/def > @abc/dev@1.2.3
function mapPackages(
  dependencies: Record<string, NpmDependency>,
  packages: Dependencies,
  lockfileVersion: number
): LockFileData['dependencies'] {
  const mappedPackages: LockFileData['dependencies'] = {};

  if (lockfileVersion === 1) {
    Object.entries(dependencies).forEach(([packageName, value]) => {
      const { newKey, packagePath } = prepareDependency(
        packageName,
        value.version,
        mappedPackages
      );

      mapPackageDependency(
        mappedPackages,
        packageName,
        newKey,
        packagePath,
        value,
        lockfileVersion,
        true
      );
      // we need to map the nested dependencies recursively
      mapPackageDependencies(
        mappedPackages,
        value.dependencies,
        packagePath,
        lockfileVersion
      );
    });
  } else {
    Object.entries(packages).forEach(([packagePath, value]) => {
      // we parse root package.json separately
      if (packagePath !== '') {
        const packageName = packagePath.split('node_modules/').pop();
        const { newKey } = prepareDependency(
          packageName,
          value.version,
          mappedPackages,
          undefined,
          packagePath
        );

        mapPackageDependency(
          mappedPackages,
          packageName,
          newKey,
          packagePath,
          value,
          lockfileVersion
        );
      }
    });
  }

  return mappedPackages;
}

function prepareDependency(
  packageName: string,
  version: string,
  mappedPackages: LockFileData['dependencies'],
  pathPrefix: string = '',
  path?: string
) {
  mappedPackages[packageName] = mappedPackages[packageName] || {};
  const newKey = packageName + '@' + version;
  const packagePath =
    path || pathPrefix
      ? `${pathPrefix}/node_modules/${packageName}`
      : `node_modules/${packageName}`;
  return { newKey, packagePath };
}

function mapPackageDependency(
  mappedPackages: LockFileData['dependencies'],
  packageName: string,
  key: string,
  packagePath: string,
  value: NpmDependency | Omit<PackageDependency, 'packageMeta'>,
  lockfileVersion: number,
  isRootVersion?: boolean
) {
  const { dev, peer, optional } = value;
  const packageMeta = {
    path: packagePath,
    dev,
    peer,
    optional,
  };
  if (!mappedPackages[packageName][key]) {
    // const packageDependencies = lockfileVersion === 1 ? requires : dependencies;
    const rootVersion =
      isRootVersion ?? packagePath.split('/node_modules/').length === 1;

    if (lockfileVersion === 1) {
      const { requires, ...rest } = value;
      if (requires) {
        rest.dependencies = requires;
      }
      value = rest;
    }

    mappedPackages[packageName][key] = {
      ...(value as Omit<PackageDependency, 'packageMeta'>),
      packageMeta: [],
      rootVersion,
    };
  }

  mappedPackages[packageName][key].packageMeta.push(packageMeta);
}

function mapPackageDependencies(
  mappedPackages: LockFileData['dependencies'],
  dependencies: Record<string, NpmDependency>,
  parentPath: string,
  lockfileVersion: number
): void {
  if (!dependencies) {
    return;
  }

  Object.entries(dependencies).forEach(([packageName, value]) => {
    const { newKey, packagePath } = prepareDependency(
      packageName,
      value.version,
      mappedPackages,
      parentPath
    );

    mapPackageDependency(
      mappedPackages,
      packageName,
      newKey,
      packagePath,
      value,
      lockfileVersion,
      false
    );

    mapPackageDependencies(
      mappedPackages,
      value.dependencies,
      packagePath,
      lockfileVersion
    );
  });
}

/**
 * Generates package-lock.json file from `LockFileData` object
 *
 * @param lockFile
 * @returns
 */
export function stringifyNpmLockFile(lockFileData: LockFileData): string {
  const notV1 = lockFileData.lockFileMetadata.metadata.lockfileVersion > 1;
  const notV3 = lockFileData.lockFileMetadata.metadata.lockfileVersion < 3;

  // initialize the lockfile collections
  const dependencies = {};
  const packages: Dependencies = {
    ...(notV1 && { '': lockFileData.lockFileMetadata.rootPackage }),
  };

  const keys = Object.keys(lockFileData.dependencies);
  for (let i = 0; i < keys.length; i++) {
    const packageName = keys[i];
    const packageVersions = lockFileData.dependencies[packageName];
    const values = Object.values(packageVersions);

    values.forEach((value) => {
      if (notV1) {
        unmapPackage(packages, value);
      }
      if (notV3) {
        unmapDependencies(dependencies, packageName, value);
      }
    });
  }

  // generate package lock JSON
  const lockFileJson: NpmLockFile = {
    ...lockFileData.lockFileMetadata.metadata,
    ...(notV1 && {
      packages: sortObject(
        packages,
        (value) => value,
        false,
        (a, b) => a.localeCompare(b)
      ),
    }),
    ...(notV3 && { dependencies: sortDependencies(dependencies) }),
  };

  return JSON.stringify(lockFileJson, null, 2) + '\n';
}

// remapping the package back to package-lock format
function unmapPackage(packages: Dependencies, dependency: PackageDependency) {
  const {
    packageMeta,
    rootVersion,
    version,
    resolved,
    integrity,
    dev,
    peer,
    optional,
    ...value
  } = dependency;
  // we need to decompose value, to achieve particular field ordering

  for (let i = 0; i < packageMeta.length; i++) {
    const { path, dev, peer, optional } = packageMeta[i];
    // we are sorting the properties to get as close as possible to the original package-lock.json
    packages[path] = {
      version,
      resolved,
      integrity,
      dev,
      peer,
      optional,
      ...value,
    };
  }
}

function unmapDependencies(
  dependencies: Record<string, NpmDependency>,
  packageName: string,
  { packageMeta, ...value }: PackageDependency & { packageMeta: PackageMeta[] }
): void {
  const { version, resolved, integrity, devOptional } = value;

  for (let i = 0; i < packageMeta.length; i++) {
    const { path, dev, optional, peer } = packageMeta[i];
    const projectPath = path.split('node_modules/').slice(1);

    const requires = unmapDependencyRequires(value);
    const innerDeps = getProjectNodeAndEnsureParentHierarchy(
      projectPath,
      dependencies
    );

    // sorting fields to match package-lock structure
    innerDeps[packageName] = {
      version,
      resolved,
      integrity,
      dev,
      devOptional,
      optional,
      peer,
      requires,
      ...innerDeps[packageName],
    };
  }
}

// generates/ensures entire parent hierarchy exists for the given project path
// returns pointer to last project in the path
function getProjectNodeAndEnsureParentHierarchy(
  projects: string[],
  dependencies: Record<string, NpmDependency>
) {
  while (projects.length > 1) {
    const parentName = projects.shift().replace(/\/$/, '');
    if (!dependencies[parentName]) {
      dependencies[parentName] = {} as NpmDependency;
    }
    if (!dependencies[parentName].dependencies) {
      dependencies[parentName].dependencies = {};
    }
    dependencies = dependencies[parentName].dependencies;
  }
  return dependencies;
}

// combine dependencies and optionalDependencies into requires and sort them
function unmapDependencyRequires(
  value: Omit<PackageDependency, 'packageMeta'>
): Record<string, string> {
  if (!value.dependencies && !value.optionalDependencies) {
    return undefined;
  }
  const dependencies = {
    ...(value.dependencies || {}),
    ...(value.optionalDependencies || {}),
  };
  const sortedKeys = Object.keys(dependencies).sort((a, b) =>
    a.localeCompare(b)
  );
  const result = {};
  for (let i = 0; i < sortedKeys.length; i++) {
    const key = sortedKeys[i];
    result[key] = dependencies[key];
  }
  return result;
}

// recursively sort dependencies
function sortDependencies(
  unsortedDependencies: Record<string, NpmDependency>
): Record<string, NpmDependency> {
  const dependencies = {};
  const sortedKeys = Object.keys(unsortedDependencies).sort((a, b) =>
    a.localeCompare(b)
  );

  for (let i = 0; i < sortedKeys.length; i++) {
    const value = unsortedDependencies[sortedKeys[i]];
    dependencies[sortedKeys[i]] = value;
    if (value.dependencies) {
      value.dependencies = sortDependencies(value.dependencies);
    }
  }

  return dependencies;
}

/**
 * Returns matching version of the dependency
 */
export function transitiveDependencyNpmLookup({
  packageName,
  parentPackages,
  versions,
  version,
}: TransitiveLookupFunctionInput): PackageDependency {
  const packageDependencies = Object.values(versions);

  for (let i = 0; i < packageDependencies.length; i++) {
    if (satisfies(packageDependencies[i].version, version)) {
      const packageMeta = packageDependencies[i].packageMeta.find((p) =>
        isPathMatching(p.path, packageName, parentPackages)
      );
      if (packageMeta) {
        return {
          ...packageDependencies[i],
          packageMeta: [packageMeta],
        };
      }
    }
  }

  // otherwise return the root version
  return Object.values(versions).find((v) => v.rootVersion);
}

function isPathMatching(
  path: string,
  packageName: string,
  parentPackages: string[]
): boolean {
  const packages = path.split(/\/?node_modules\//).slice(1);
  if (packages[packages.length - 1] !== packageName) {
    return false;
  }
  const locations = parentPackages
    .map((p) => packages.indexOf(p))
    .filter((p) => p !== -1);
  if (locations.length === 0) {
    return false;
  }
  for (let i = 0; i < locations.length - 2; i++) {
    if (locations[i] > locations[i + 1]) {
      return false;
    }
  }
  return true;
}

/**
 * Prunes the lock file data based on the list of packages and their transitive dependencies
 *
 * @param lockFileData
 * @returns
 */
export function pruneNpmLockFile(
  lockFileData: LockFileData,
  packages: string[],
  projectName?: string
): LockFileData {
  let isV1;

  // NPM V1 does not track full dependency list in the lock file,
  // so we can't reuse the lock file to generate a new one
  if (lockFileData.lockFileMetadata.metadata.lockfileVersion === 1) {
    output.warn({
      title: 'Pruning v1 lock file',
      bodyLines: [
        `If your "node_modules" are not in sync with the lock file, you might get inaccurate results.`,
        `Run "npm ci" to ensure your installed packages are synchronized or upgrade to NPM v7+ to benefit from the new lock file format`,
      ],
    });
    isV1 = true;
  }

  const dependencies = pruneDependencies(
    lockFileData.dependencies,
    packages,
    isV1
  );
  const lockFileMetadata = {
    ...lockFileData.lockFileMetadata,
    ...pruneRootPackage(lockFileData, packages, projectName),
  };
  let prunedLockFileData: LockFileData;
  prunedLockFileData = {
    dependencies,
    lockFileMetadata,
    hash: generatePrunnedHash(lockFileData.hash, packages, projectName),
  };
  return prunedLockFileData;
}

function pruneRootPackage(
  lockFileData: LockFileData,
  packages: string[],
  projectName?: string
): Record<string, any> {
  if (lockFileData.lockFileMetadata.metadata.lockfileVersion === 1) {
    return undefined;
  }
  const rootPackage = {
    name: projectName || lockFileData.lockFileMetadata.rootPackage.name,
    version: lockFileData.lockFileMetadata.rootPackage.version,
    ...(lockFileData.lockFileMetadata.rootPackage.license && {
      license: lockFileData.lockFileMetadata.rootPackage.license,
    }),
    dependencies: {} as Record<string, string>,
  };
  for (const packageName of packages) {
    const version = Object.values(lockFileData.dependencies[packageName]).find(
      (v) => v.rootVersion
    ).version;
    rootPackage.dependencies[packageName] = version;
  }
  rootPackage.dependencies = sortObject(rootPackage.dependencies);

  return { rootPackage };
}

// iterate over packages to collect the affected tree of dependencies
function pruneDependencies(
  dependencies: LockFileData['dependencies'],
  packages: string[],
  isV1?: boolean
): LockFileData['dependencies'] {
  const result: LockFileData['dependencies'] = {};

  packages.forEach((packageName) => {
    if (dependencies[packageName]) {
      const [key, { packageMeta, dev, peer, optional, ...value }] =
        Object.entries(dependencies[packageName]).find(
          ([_, v]) => v.rootVersion
        );

      result[packageName] = result[packageName] || {};
      result[packageName][key] = Object.assign(value, {
        packageMeta: [{ path: `node_modules/${packageName}` }],
      });

      pruneTransitiveDependencies(
        [packageName],
        dependencies,
        result,
        result[packageName][key],
        isV1
      );
    } else {
      console.warn(
        `Could not find ${packageName} in the lock file. Skipping...`
      );
    }
  });

  return result;
}

// find all transitive dependencies of already pruned packages
// and adds them to the collection
// recursively prune their dependencies
function pruneTransitiveDependencies(
  parentPackages: string[],
  dependencies: LockFileData['dependencies'],
  prunedDeps: LockFileData['dependencies'],
  value: PackageDependency,
  isV1?: boolean,
  modifier?: 'dev' | 'optional' | 'peer'
): void {
  let packageJSON: PackageDependency;
  if (isV1) {
    const pathToPackageJSON = joinPathFragments(
      workspaceRoot,
      value.packageMeta[0].path,
      'package.json'
    );
    // if node_modules are our of sync with lock file, we might not have the package.json
    if (existsSync(pathToPackageJSON)) {
      packageJSON = readJsonFile(pathToPackageJSON);
    }
  }
  if (
    !value.dependencies &&
    !value.peerDependencies &&
    !packageJSON?.peerDependencies
  ) {
    return;
  }

  Object.entries({
    ...value.dependencies,
    ...value.peerDependencies,
    ...value.optionalDependencies,
    ...packageJSON?.peerDependencies,
  }).forEach(([packageName, version]: [string, string]) => {
    const versions = dependencies[packageName];
    if (versions) {
      const dependency = transitiveDependencyNpmLookup({
        packageName,
        parentPackages,
        versions,
        version,
      });
      if (dependency) {
        // dev/optional/peer dependencies can be changed during the pruning process
        // so we need to update them
        if (!prunedDeps[packageName]) {
          prunedDeps[packageName] = {};
        }
        const key = `${packageName}@${dependency.version}`;
        if (prunedDeps[packageName][key]) {
          const currentMeta = prunedDeps[packageName][key].packageMeta;

          if (
            !currentMeta.find((p) => p.path === dependency.packageMeta[0].path)
          ) {
            const packageMeta = setPackageMetaModifiers(
              packageName,
              dependency,
              packageJSON || value,
              modifier
            );
            currentMeta.push(packageMeta);
            currentMeta.sort();
          }
        } else {
          const packageMeta = setPackageMetaModifiers(
            packageName,
            dependency,
            packageJSON || value,
            modifier
          );

          dependency.packageMeta = [packageMeta];
          prunedDeps[packageName][key] = dependency;
          // recurively collect dependencies
          pruneTransitiveDependencies(
            [...parentPackages, packageName],
            dependencies,
            prunedDeps,
            prunedDeps[packageName][key],
            isV1,
            getModifier(packageMeta)
          );
        }
      }
    }
  });
}

function getModifier(
  packageMeta: PackageMeta
): 'dev' | 'optional' | 'peer' | undefined {
  if (packageMeta.dev) {
    return 'dev';
  } else if (packageMeta.optional) {
    return 'optional';
  } else if (packageMeta.peer) {
    return 'peer';
  }
}

function setPackageMetaModifiers(
  packageName: string,
  dependency: PackageDependency,
  parent: PackageDependency,
  modifier?: 'dev' | 'optional' | 'peer'
): PackageMeta {
  const packageMeta: PackageMeta = { path: dependency.packageMeta[0].path };

  if (parent.devDependencies?.[packageName]) {
    packageMeta.dev = true;
  } else if (parent.optionalDependencies?.[packageName]) {
    packageMeta.optional = true;
  } else if (parent.peerDependencies?.[packageName]) {
    packageMeta.peer = true;
  } else if (modifier === 'dev') {
    packageMeta.dev = true;
  } else if (modifier === 'optional') {
    packageMeta.optional = true;
  }
  // peer is carried over from the parent
  if (modifier === 'peer') {
    packageMeta.peer = true;
  }

  return packageMeta;
}
