import {
  LockFileData,
  PackageDependency,
  PackageVersions,
} from './lock-file-type';
import { sortObject } from './utils';

type PackageMeta = {
  path: string;
  optional?: boolean;
  dev?: boolean;
};

type Dependencies = Record<string, PackageDependency>;

type NpmDependency = {
  version: string;
  resolved: string;
  integrity: string;
  requires?: Record<string, string>;
  dependencies?: Record<string, NpmDependency>;
};

export type NpmLockFile = {
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
  const { packages, dependencies, ...metadata } = JSON.parse(
    lockFile
  ) as NpmLockFile;
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
    const packageName = key.slice(key.lastIndexOf('node_modules/') + 13);
    mappedPackages[packageName] = mappedPackages[packageName] || {};

    const newKey = packageName + '@' + value.version;
    mappedPackages[packageName][newKey] = mappedPackages[packageName][
      newKey
    ] || {
      ...value,
      packageMeta: [],
    };
    mappedPackages[packageName][newKey].packageMeta.push({
      path: key,
      dev,
      optional,
    });
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
  const packages = {
    '': lockFileData.lockFileMetadata.rootPackage,
  };
  Object.entries(lockFileData.dependencies).forEach(
    ([packageName, packageVersions]) => {
      Object.values(packageVersions).forEach(({ packageMeta, ...value }) => {
        (packageMeta as PackageMeta[]).forEach(({ path, dev, optional }) => {
          const {
            version,
            resolved,
            integrity,
            license,
            devOptional,
            hasInstallScript,
            ...rest
          } = value;
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
        });
        unmapDependencies(
          dependencies,
          packageName,
          value,
          packageMeta as PackageMeta[]
        );
      });
    }
  );

  const lockFileJson: NpmLockFile = {
    ...lockFileData.lockFileMetadata.metadata,
    packages: sortObject(packages),
    dependencies: sortDependencies(dependencies),
  };

  return JSON.stringify(lockFileJson, null, 2) + '\n';
}

function unmapDependencies(
  dependencies: Record<string, NpmDependency>,
  packageName: string,
  value: Omit<PackageDependency, 'packageMeta'>,
  packageMeta: PackageMeta[]
): void {
  packageMeta.forEach(({ path, dev, optional }) => {
    const projectPath = path.split('node_modules/').slice(1);
    let current = dependencies;
    while (projectPath.length > 1) {
      const parentName = projectPath.shift().replace(/\/$/, '');
      current[parentName] = current[parentName] || ({} as NpmDependency);
      const parent = current[parentName];
      parent.dependencies = parent.dependencies || {};
      current = parent.dependencies;
    }
    let unsortedRequires;
    if (value.dependencies) {
      unsortedRequires = value.dependencies;
    }
    if (value.optionalDependencies) {
      unsortedRequires = {
        ...unsortedRequires,
        ...value.optionalDependencies,
      };
    }
    let requires;
    if (unsortedRequires) {
      Object.entries(unsortedRequires)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([key, value]) => {
          requires = requires || {};
          requires[key] = value;
        });
    }
    current[packageName] = {
      version: value.version,
      resolved: value.resolved,
      integrity: value.integrity,
      ...(dev !== undefined && { dev }),
      ...(value.devOptional !== undefined && {
        devOptional: value.devOptional,
      }),
      ...(optional !== undefined && { optional }),
      ...(requires && { requires }),
      ...current[packageName],
    };
  });
}

// todo(meeroslav): use sortObject here as well
function sortDependencies(
  unsortedDependencies: Record<string, NpmDependency>
): Record<string, NpmDependency> {
  const dependencies = {};
  Object.entries(unsortedDependencies)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([key, value]) => {
      dependencies[key] = {
        ...value,
        ...(value.dependencies && {
          dependencies: sortDependencies(value.dependencies),
        }),
      };
    });
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
