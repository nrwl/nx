import { parseSyml } from '@yarnpkg/parsers';
import { LockFileData, PackageDependency } from './lock-file-type';

export type YarnLockFile = Record<string, PackageDependency<string>>;

export type YarnBerryLockFile = {
  __metadata: {
    version: string;
    cacheKey: string;
  };
} & YarnLockFile;

/**
 * Parses Berry yarn.lock syml file
 * ```
 * __metadata:
 *    version: 7
 *    cacheKey: 9
 *
 * "{package}@npm:{versionRange}":
 *   version {version}
 *   {additionalFields}
 *   dependencies?:
 *     "{package}": "npm:{versionRange}"
 * ```
 * and maps to `LockFileData` object:
 * ```
 * {
 *  lockFileMetadata: {
 *   __metadata: { version: 7, cacheKey: 9 }
 *  },
 *  "{package}@npm:{version}": {
 *    version: {version},
 *    {additionalFields},
 *    packageMeta: ["{package}@npm:{versionRange}"]
 *    dependencies: {
 *     "{package}": "npm:{versionRange}"
 *    }
 *  }
 * }
 * ```
 *
 * or parses classic yarn.lock file to `LockFileData` object
 * ```
 * "{package}@{versionRange}":
 *   version {version}
 *   {additionalFields}
 *   dependencies?:
 *     "{package}": "{versionRange}"
 * ```
 * and maps to `LockFileData` object:
 * ```
 * {
 *  "{package}@{version}": {
 *    version: {version},
 *    {additionalFields},
 *    packageMeta: ["{package}@{versionRange}"]
 *    dependencies: {
 *     "{package}": "{versionRange}"
 *    }
 *  }
 * }
 * ```
 *
 * @param lockFile
 * @returns
 */
export function parseLockFile(
  lockFile: string,
  isBerry?: boolean
): LockFileData {
  const { __metadata, ...dependencies } = parseSyml(lockFile);
  return {
    dependencies: mapPackages(dependencies),
    ...(__metadata ? { lockFileMetadata: { __metadata } } : {}),
  };
}

function mapPackages(packages: YarnLockFile): YarnLockFile {
  const mappedPackages: YarnLockFile = {};
  Object.entries(packages).forEach(([key, value]) => {
    const packageName = key.slice(0, key.lastIndexOf('@'));
    const newKey = `${packageName}@${value.version}`;
    mappedPackages[newKey] = mappedPackages[newKey] || {
      ...value,
      packageMeta: [],
    };
    mappedPackages[newKey].packageMeta.push(key);
  });
  return mappedPackages;
}
