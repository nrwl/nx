import { LockFileData, PackageDependency } from './lock-file-type';
import { load, dump } from '@zkochan/js-yaml';

type PackageMeta = {
  key: string;
  specifier?: string;
  isDevDependency?: boolean;
  isDependency?: boolean;
  dependencyDetails: Record<string, Record<string, string>>;
};

type Dependencies = Record<
  string,
  Omit<PackageDependency<string>, 'packageMeta'>
>;

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
export function parseLockFile(lockFile: string): LockFileData<PackageMeta> {
  const { dependencies, devDependencies, packages, specifiers, ...metadata } =
    load(lockFile) as PnpmLockFile;
  return {
    dependencies: mapPackages(
      dependencies,
      devDependencies,
      specifiers,
      packages
    ),
    lockFileMetadata: { ...metadata },
  };
}

const LOCKFILE_YAML_FORMAT = {
  blankLines: true,
  lineWidth: 1000,
  noCompatMode: true,
  noRefs: true,
  sortKeys: false,
};

/**
 * Generates pnpm-lock.yml file from `LockFileData` object
 *
 * @param lockFile
 * @returns
 */
export function stringifyLockFile(
  lockFileData: LockFileData<PackageMeta>
): string {
  const specifiers: Record<string, string> = {};
  const devDependencies: Record<string, string> = {};
  const dependencies: Record<string, string> = {};
  const packages: Dependencies = {};
  Object.entries(lockFileData.dependencies).forEach(
    ([dependencyKey, { packageMeta, resolution, engines }]) => {
      const packageName = dependencyKey.slice(
        0,
        dependencyKey.lastIndexOf('@')
      );
      packageMeta.forEach(
        ({
          key,
          specifier,
          isDependency,
          isDevDependency,
          dependencyDetails,
        }) => {
          const metaVersion = key.slice(key.lastIndexOf('/') + 1);
          if (isDependency) {
            dependencies[packageName] = metaVersion;
          }
          if (isDevDependency) {
            devDependencies[packageName] = metaVersion;
          }
          if (specifier) {
            specifiers[packageName] = specifier;
          }
          packages[key] = {
            resolution,
            engines,
            ...dependencyDetails,
          };
        }
      );
    }
  );

  return dump(
    {
      ...lockFileData.lockFileMetadata,
      specifiers: sortObject(specifiers),
      ...(dependencies && { dependencies: sortObject(dependencies) }),
      ...(devDependencies && { devDependencies: sortObject(devDependencies) }),
      packages: sortObject(packages),
    },
    LOCKFILE_YAML_FORMAT
  );
}

function mapPackages(
  dependencies: Record<string, string>,
  devDependencies: Record<string, string>,
  specifiers: Record<string, string>,
  packages: Dependencies
): LockFileData<PackageMeta>['dependencies'] {
  const mappedPackages: LockFileData<PackageMeta>['dependencies'] = {};
  Object.entries(packages).forEach(([key, value]) => {
    const packageName = key.slice(1, key.lastIndexOf('/'));
    const matchingVersion = key.slice(key.lastIndexOf('/') + 1);
    const version = matchingVersion.split('_')[0];
    const isDependency = dependencies[packageName] === matchingVersion;
    const isDevDependency = devDependencies[packageName] === matchingVersion;
    const { resolution, engines, ...rest } = value;
    const meta = {
      key,
      isDependency,
      isDevDependency,
      dependencyDetails: rest,
      specifier:
        isDependency || isDevDependency ? specifiers[packageName] : undefined,
    };
    mappedPackages[`${packageName}@${version}`] = mappedPackages[
      `${packageName}@${version}`
    ] || {
      resolution,
      engines,
      version,
      packageMeta: [],
    };
    mappedPackages[`${packageName}@${version}`].packageMeta.push(meta);
  });
  return mappedPackages;
}

function sortObject<T = string>(obj: Record<string, T>) {
  const result: Record<string, T> = {};
  Object.keys(obj)
    .sort()
    .forEach((key) => {
      result[key] = obj[key];
    });
  return result;
}
