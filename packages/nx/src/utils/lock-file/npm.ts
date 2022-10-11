import { LockFileData, PackageDependency } from './lock-file-type';
import { sortObject, hashString } from './utils';

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
  devOptional?: boolean;
  optional?: boolean;
};

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
    dependencies: mapPackages(dependencies, packages),
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
  packages: Dependencies
): LockFileData['dependencies'] {
  const mappedPackages: LockFileData['dependencies'] = {};

  Object.entries(dependencies).forEach(([packageName, value]) => {
    mappedPackages[packageName] = mappedPackages[packageName] || {};
    const packagePath = `node_modules/${packageName}`;
    const newKey = packageName + '@' + value.version;
    mappedPackages[packageName][newKey] = mapDependency(
      packagePath,
      value,
      true,
      packages && { packageData: packages[packagePath] }
    );
    mapPackageDependencies(
      mappedPackages,
      packages,
      value.dependencies,
      packagePath
    );
  });

  return mappedPackages;
}

function mapDependency(
  packagePath: string,
  { dev, optional, ...value }: NpmDependency,
  rootVersion: boolean,
  packageData?: { packageData: Omit<PackageDependency, 'packageMeta'> }
): PackageDependency {
  const packageMeta = {
    path: packagePath,
    dev,
    optional,
    ...packageData,
  };
  return {
    ...value,
    // invert those two fields to match other package managers
    requires: value.dependencies,
    dependencies: value.requires,
    packageMeta: [packageMeta],
    rootVersion,
  };
}

function mapPackageDependencies(
  mappedPackages: LockFileData['dependencies'],
  packages: Dependencies,
  dependencies: Record<string, NpmDependency>,
  parentPath: string
): void {
  if (!dependencies) {
    return;
  }

  Object.entries(dependencies).forEach(([packageName, value]) => {
    mappedPackages[packageName] = mappedPackages[packageName] || {};
    const packagePath = `${parentPath}/node_modules/${packageName}`;
    const newKey = packageName + '@' + value.version;
    if (mappedPackages[packageName][newKey]) {
      mappedPackages[packageName][newKey].packageMeta.push({
        path: packagePath,
        dev: value.dev,
        optional: value.optional,
        ...(packages && { packageData: packages[packagePath] }),
      });
    } else {
      mappedPackages[packageName][newKey] = mapDependency(
        packagePath,
        value,
        false,
        packages && { packageData: packages[packagePath] }
      );
    }
    mapPackageDependencies(
      mappedPackages,
      packages,
      value.dependencies,
      packagePath
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
  const dependencies = {};
  const isV2 = lockFileData.lockFileMetadata.metadata.lockfileVersion > 1;
  const packages: Dependencies = {
    ...(isV2 && { '': lockFileData.lockFileMetadata.rootPackage }),
  };

  const keys = Object.keys(lockFileData.dependencies);
  for (let i = 0; i < keys.length; i++) {
    const packageName = keys[i];
    const packageVersions = lockFileData.dependencies[packageName];
    const values = Object.values(packageVersions);

    values.forEach((value) => {
      if (isV2) {
        unmapPackage(packages, value);
      }
      unmapPackageDependencies(dependencies, packageName, value);
    });
  }

  // generate package lock JSON
  const lockFileJson: NpmLockFile = {
    ...lockFileData.lockFileMetadata.metadata,
    ...(isV2 && { packages: sortObject(packages) }),
    dependencies: sortDependencies(dependencies),
  };

  return JSON.stringify(lockFileJson, null, 2) + '\n';
}

// remapping the package back to package-lock format
function unmapPackage(
  packages: Dependencies,
  { packageMeta }: PackageDependency
) {
  // we need to decompose value, to achieve particular field ordering

  for (let i = 0; i < packageMeta.length; i++) {
    const { path, packageData } = packageMeta[i];
    // we are sorting the properties to get as close as possible to the original package-lock.json
    packages[path] = packageData;
  }
}

function unmapPackageDependencies(
  dependencies: Record<string, NpmDependency>,
  packageName: string,
  { packageMeta, ...value }: PackageDependency & { packageMeta: PackageMeta[] }
): void {
  const { version, resolved, integrity, devOptional } = value;

  for (let i = 0; i < packageMeta.length; i++) {
    const { path, dev, optional } = packageMeta[i];
    const projectPath = path.split('node_modules/').slice(1);

    const innerDeps = getProjectNodeAndEnsureParentHierarchy(
      projectPath,
      dependencies
    );
    const requires = unmapDependencyRequires(value);

    // sorting fields to match package-lock structure
    innerDeps[packageName] = {
      version,
      resolved,
      integrity,
      dev,
      devOptional,
      optional,
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
  const sortedKeys = Object.keys(dependencies).sort();
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
  const sortedKeys = Object.keys(unsortedDependencies).sort();

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
 * Prunes the lock file data based on the list of packages and their transitive dependencies
 *
 * @param lockFileData
 * @returns
 */
export function pruneNpmLockFile(
  lockFileData: LockFileData,
  packages: string[]
): LockFileData {
  // todo(meeroslav): This functionality has not been implemented yet
  console.warn(
    'Pruning package-lock.json is not yet implemented. Returning entire lock file'
  );
  return lockFileData;
}
