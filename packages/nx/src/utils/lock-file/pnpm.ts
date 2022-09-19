import { LockFileData, PackageDependency } from './lock-file-type';
import { load, dump } from '@zkochan/js-yaml';
import { sortObject } from './utils';

type PackageMeta = {
  key: string;
  specifier?: string;
  isDevDependency?: boolean;
  isDependency?: boolean;
  dependencyDetails: Record<string, Record<string, string>>;
};

type Dependencies = Record<string, Omit<PackageDependency, 'packageMeta'>>;

type InlineSpecifier = {
  version: string;
  specifier: string;
};

export type PnpmLockFile = {
  lockfileVersion: string;
  specifiers?: Record<string, string>;
  dependencies?: Record<
    string,
    string | { version: string; specifier: string }
  >;
  devDependencies?: Record<
    string,
    string | { version: string; specifier: string }
  >;
  packages: Dependencies;
};

const LOCKFILE_YAML_FORMAT = {
  blankLines: true,
  lineWidth: 1000,
  noCompatMode: true,
  noRefs: true,
  sortKeys: false,
};

/**
 * Parses pnpm-lock.yaml file to `LockFileData` object
 *
 * @param lockFile
 * @returns
 */
export function parseLockFile(lockFile: string): LockFileData {
  const { dependencies, devDependencies, packages, specifiers, ...metadata } =
    load(lockFile) as PnpmLockFile;

  return {
    dependencies: mapPackages(
      dependencies,
      devDependencies,
      specifiers,
      packages,
      metadata.lockfileVersion.toString().endsWith('inlineSpecifiers')
    ),
    lockFileMetadata: { ...metadata },
  };
}

function mapPackages(
  dependencies: Record<string, string | InlineSpecifier>,
  devDependencies: Record<string, string | InlineSpecifier>,
  specifiers: Record<string, string>,
  packages: Dependencies,
  inlineSpecifiers: boolean
): LockFileData['dependencies'] {
  const mappedPackages: LockFileData['dependencies'] = {};
  Object.entries(packages).forEach(([key, value]) => {
    const packageName = key.slice(1, key.lastIndexOf('/'));
    mappedPackages[packageName] = mappedPackages[packageName] || {};

    const matchingVersion = key.slice(key.lastIndexOf('/') + 1);
    const version = matchingVersion.split('_')[0];
    let isDependency, isDevDependency, specifier;
    if (inlineSpecifiers) {
      if (
        dependencies &&
        (dependencies[packageName] as InlineSpecifier)?.version ===
          matchingVersion
      ) {
        isDependency = true;
        specifier = (dependencies[packageName] as InlineSpecifier).specifier;
      } else {
        isDependency = false;
      }
      if (
        devDependencies &&
        (devDependencies[packageName] as InlineSpecifier)?.version ===
          matchingVersion
      ) {
        isDevDependency = true;
        specifier = (devDependencies[packageName] as InlineSpecifier).specifier;
      } else {
        isDevDependency = false;
      }
    } else {
      isDependency =
        dependencies && dependencies[packageName] === matchingVersion;
      isDevDependency =
        devDependencies && devDependencies[packageName] === matchingVersion;
      if (isDependency || isDevDependency) {
        specifier = specifiers[packageName];
      }
    }
    const { resolution, engines, ...rest } = value;
    const meta = {
      key,
      isDependency,
      isDevDependency,
      specifier,
      dependencyDetails: rest,
    };
    const newKey = `${packageName}@${version}`;
    mappedPackages[packageName][newKey] = mappedPackages[packageName][
      newKey
    ] || {
      resolution,
      engines,
      version,
      packageMeta: [],
    };
    mappedPackages[packageName][newKey].packageMeta.push(meta);
  });
  return mappedPackages;
}

/**
 * Generates pnpm-lock.yml file from `LockFileData` object
 *
 * @param lockFile
 * @returns
 */
export function stringifyLockFile(lockFileData: LockFileData): string {
  const pnpmLockFile = unmapPackages(lockFileData);

  return dump(pnpmLockFile, LOCKFILE_YAML_FORMAT);
}

function unmapPackages(lockFileData: LockFileData): PnpmLockFile {
  const devDependencies: Record<string, string | InlineSpecifier> = {};
  const dependencies: Record<string, string | InlineSpecifier> = {};
  const packages: Dependencies = {};
  const specifiers: Record<string, string> = {};
  const inlineSpecifiers = lockFileData.lockFileMetadata.lockfileVersion
    .toString()
    .endsWith('inlineSpecifiers');

  Object.entries(lockFileData.dependencies).forEach(([packageName, versions]) =>
    Object.values(versions).forEach(({ packageMeta, resolution, engines }) => {
      (packageMeta as PackageMeta[]).forEach(
        ({
          key,
          specifier,
          isDependency,
          isDevDependency,
          dependencyDetails,
        }) => {
          const version = key.slice(key.lastIndexOf('/') + 1);
          if (isDependency) {
            dependencies[packageName] = inlineSpecifiers
              ? { specifier, version }
              : version;
          }
          if (isDevDependency) {
            devDependencies[packageName] = inlineSpecifiers
              ? { specifier, version }
              : version;
          }
          if (!inlineSpecifiers && specifier) {
            specifiers[packageName] = specifier;
          }
          packages[key] = {
            resolution,
            engines,
            ...dependencyDetails,
          };
        }
      );
    })
  );

  return {
    ...(lockFileData.lockFileMetadata as { lockfileVersion: string }),
    specifiers: sortObject(specifiers),
    dependencies: sortObject(dependencies),
    devDependencies: sortObject(devDependencies),
    packages: sortObject(packages),
  };
}
