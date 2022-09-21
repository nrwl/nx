import { LockFileData, PackageDependency } from './lock-file-type';
import { sortObject } from './utils';

type PackageMeta = {
  path: string;
  optional?: boolean;
  dev?: boolean;
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
  packages: Dependencies;
  dependencies?: Record<string, NpmDependency>;
};

/**
 * Parses package-lock.json file to `LockFileData` object
 *
 * @param lockFile
 * @returns
 */
export function parseNpmLockFile(lockFile: string): LockFileData {
  const { packages, dependencies, ...metadata } = JSON.parse(lockFile);
  return {
    dependencies: mapPackages(packages),
    lockFileMetadata: {
      metadata,
      rootPackage: packages[''],
    },
  };
}

// Maps /node_modules/@abc/def with version 1.2.3 => @abc/def > @abc/dev@1.2.3
function mapPackages(packages: Dependencies): LockFileData['dependencies'] {
  const mappedPackages: LockFileData['dependencies'] = {};

  Object.entries(packages).forEach(([key, { dev, optional, ...value }]) => {
    // skip root package
    if (!key) {
      return;
    }
    // key can have several instances of 'node_modules' if hoisted package
    const packageName = key.slice(key.lastIndexOf('node_modules/') + 13);
    mappedPackages[packageName] = mappedPackages[packageName] || {};

    const packageMeta = {
      path: key,
      dev,
      optional,
    };

    const newKey = packageName + '@' + value.version;
    if (mappedPackages[packageName][newKey]) {
      mappedPackages[packageName][newKey].packageMeta.push(packageMeta);
    } else {
      mappedPackages[packageName][newKey] = {
        ...value,
        packageMeta: [packageMeta],
      };
    }
  });
  return mappedPackages;
}

/**
 * Generates package-lock.json file from `LockFileData` object
 *
 * @param lockFile
 * @returns
 */
export function stringifyNpmLockFile(lockFileData: LockFileData): string {
  const dependencies = {};
  const packages: Dependencies = {
    '': lockFileData.lockFileMetadata.rootPackage,
  };

  const keys = Object.keys(lockFileData.dependencies);
  for (let i = 0; i < keys.length; i++) {
    const packageName = keys[i];
    const packageVersions = lockFileData.dependencies[packageName];
    const values = Object.values(packageVersions);

    values.forEach((value) => {
      unmapPackage(packages, value);
      unmapPackageDependencies(dependencies, packageName, value);
    });
  }

  // generate package lock JSON
  const lockFileJson: NpmLockFile = {
    ...lockFileData.lockFileMetadata.metadata,
    packages: sortObject(packages),
    dependencies: sortDependencies(dependencies),
  };

  return JSON.stringify(lockFileJson, null, 2) + '\n';
}

// remapping the package back to package-lock format
function unmapPackage(
  packages: Dependencies,
  { packageMeta, ...value }: PackageDependency
) {
  // we need to decompose value, to achieve particular field ordering
  const {
    version,
    resolved,
    integrity,
    license,
    devOptional,
    hasInstallScript,
    ...rest
  } = value;

  for (let i = 0; i < packageMeta.length; i++) {
    const { path, dev, optional } = packageMeta[i];
    // we are sorting the properties to get as close as possible to the original package-lock.json
    packages[path] = {
      version,
      resolved,
      integrity,
      dev,
      devOptional,
      hasInstallScript,
      license,
      optional,
      ...rest,
    };
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
