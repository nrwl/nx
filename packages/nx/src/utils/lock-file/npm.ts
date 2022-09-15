import { LockFileData, PackageDependency } from './lock-file-type';

type Dependencies = Record<string, PackageDependency>;

export type NpmLockFile = {
  name?: string;
  lockfileVersion: number;
  requires?: boolean;
  packages: Dependencies;
  dependencies?: Dependencies;
};

/**
 * Parses package-lock.json file
 * ```
 * {
 *  name: string;
 *  lockfileVersion: number;
 *  requires?: boolean;
 *  packages: {
 *  },
 *  dependencies: {
 *  }
 * }
 * ```
 *
 *
 * to `LockFileData` object
 *
 * @param lockFile
 * @returns
 */
export function parseLockFile(lockFile: string): LockFileData {
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

function mapPackages(packages: Dependencies): Dependencies {
  const mappedPackages: Dependencies = {};
  Object.entries(packages).forEach(([key, value]) => {
    // skip root package
    if (!key) {
      return;
    }
    const packageName = key.slice(key.lastIndexOf('node_modules/') + 13);
    mappedPackages[`${packageName}@${value.version}`] = {
      ...value,
      requestedKey: [key],
    };
  });
  return mappedPackages;
}
