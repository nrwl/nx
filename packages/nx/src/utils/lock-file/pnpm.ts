import { LockFileData, PackageDependency } from './lock-file-type';
import { load } from 'js-yaml';

type Dependencies = Record<string, PackageDependency<string>>;

export type PnpmLockFile = {
  lockfileVersion: number;
  specifiers?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  packages: Dependencies;
};

/**
 * Parses pnpm-lock.yaml file
 * ```
 * lockfileVersion: 5.2
 *
 * overrides:
 *  minimist: 1.2.4
 *
 * specifiers:
 *   {package}: {versionRange}
 *
 * dependencies:
 *   {package}: {versionWithHashOrPackage}
 *
 * devDependencies:
 *   {package}: {versionWithHashOrPackage}
 * ```
 *
 * to `LockFileData` object
 *
 * @param lockFile
 * @returns
 */
export function parseLockFile(lockFile: string): LockFileData {
  const { dependencies, devDependencies, packages, specifiers, ...metadata } =
    load(lockFile) as PnpmLockFile;
  return {
    dependencies: mapPackages(packages),
    lockFileMetadata: { ...metadata },
  };
}

function mapPackages(packages: Dependencies): Dependencies {
  const mappedPackages: Dependencies = {};
  Object.entries(packages).forEach(([key, value]) => {
    const packageName = key.slice(1, key.lastIndexOf('/'));
    const version = key.slice(key.lastIndexOf('/') + 1).split('_')[0];
    mappedPackages[`${packageName}@${version}`] = {
      ...value,
      version,
      requestedKey: [key],
    };
  });
  return mappedPackages;
}
