import { LockFileData, PackageDependency } from './lock-file-type';
import { load, dump } from '@zkochan/js-yaml';
import { hashLockFile, sortObject } from './utils';
import { defaultHashing } from '../../hasher/hashing-impl';

type PackageMeta = {
  key: string;
  specifier?: string;
  isDevDependency?: boolean;
  isDependency?: boolean;
  dependencyDetails: Record<string, Record<string, string>>;
};

type Dependencies = Record<string, Omit<PackageDependency, 'packageMeta'>>;

type VersionInfoWithInlineSpecifier = {
  version: string;
  specifier: string;
};

type PnpmLockFile = {
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
export function parsePnpmLockFile(lockFile: string): LockFileData {
  const data: PnpmLockFile = load(lockFile);
  const { dependencies, devDependencies, packages, specifiers, ...metadata } =
    data;
  const hash = hashLockFile(lockFile);

  return {
    dependencies: mapPackages(
      dependencies,
      devDependencies,
      specifiers,
      packages,
      metadata.lockfileVersion.toString().endsWith('inlineSpecifiers')
    ),
    lockFileMetadata: { ...metadata },
    hash,
  };
}

function mapPackages(
  dependencies: Record<string, string | VersionInfoWithInlineSpecifier>,
  devDependencies: Record<string, string | VersionInfoWithInlineSpecifier>,
  specifiers: Record<string, string>,
  packages: Dependencies,
  inlineSpecifiers: boolean
): LockFileData['dependencies'] {
  const mappedPackages: LockFileData['dependencies'] = {};

  Object.entries(packages).forEach(([key, value]) => {
    const { resolution, engines, ...dependencyDetails } = value;

    // construct packageMeta object
    const meta = mapMetaInformation(
      { dependencies, devDependencies, specifiers },
      inlineSpecifiers,
      key,
      dependencyDetails
    );

    // create new key
    const version = key.split('/').pop().split('_')[0];
    const packageName = key.slice(1, key.lastIndexOf('/'));
    const newKey = `${packageName}@${version}`;

    if (!mappedPackages[packageName]) {
      mappedPackages[packageName] = {};
    }
    if (mappedPackages[packageName][newKey]) {
      mappedPackages[packageName][newKey].packageMeta.push(meta);
    } else {
      mappedPackages[packageName][newKey] = {
        resolution,
        engines,
        version,
        packageMeta: [meta],
      };
    }
  });
  return mappedPackages;
}

// maps packageMeta based on dependencies, devDependencies and (inline) specifiers
function mapMetaInformation(
  {
    dependencies,
    devDependencies,
    specifiers,
  }: Omit<PnpmLockFile, 'lockfileVersion' | 'packages'>,
  hasInlineSpefiers,
  key: string,
  dependencyDetails: Record<string, Record<string, string>>
): PackageMeta {
  const matchingVersion = key.split('/').pop();
  const packageName = key.slice(1, key.lastIndexOf('/'));

  const isDependency = isVersionMatch(
    dependencies?.[packageName],
    matchingVersion,
    hasInlineSpefiers
  );
  const isDevDependency = isVersionMatch(
    devDependencies?.[packageName],
    matchingVersion,
    hasInlineSpefiers
  );

  let specifier;
  if (isDependency || isDevDependency) {
    if (hasInlineSpefiers) {
      specifier =
        getSpecifier(dependencies?.[packageName]) ||
        getSpecifier(devDependencies?.[packageName]);
    } else {
      if (isDependency || isDevDependency) {
        specifier = specifiers[packageName];
      }
    }
  }

  return {
    key,
    isDependency,
    isDevDependency,
    specifier,
    dependencyDetails,
  };
}

// version match for dependencies w/ or w/o inline specifier
function isVersionMatch(
  versionInfo: string | { version: string; specifier: string },
  matchingVersion,
  hasInlineSpefiers
): boolean {
  if (!versionInfo) {
    return false;
  }
  if (!hasInlineSpefiers) {
    return versionInfo === matchingVersion;
  }

  return (
    (versionInfo as VersionInfoWithInlineSpecifier).version === matchingVersion
  );
}

function getSpecifier(
  versionInfo: string | { version: string; specifier: string }
): string {
  return (
    versionInfo && (versionInfo as VersionInfoWithInlineSpecifier).specifier
  );
}

/**
 * Generates pnpm-lock.yml file from `LockFileData` object
 *
 * @param lockFile
 * @returns
 */
export function stringifyPnpmLockFile(lockFileData: LockFileData): string {
  const pnpmLockFile = unmapLockFile(lockFileData);

  return dump(pnpmLockFile, LOCKFILE_YAML_FORMAT);
}

// revert lock file to it's original state
function unmapLockFile(lockFileData: LockFileData): PnpmLockFile {
  const devDependencies: Record<
    string,
    string | VersionInfoWithInlineSpecifier
  > = {};
  const dependencies: Record<string, string | VersionInfoWithInlineSpecifier> =
    {};
  const packages: Dependencies = {};
  const specifiers: Record<string, string> = {};
  const inlineSpecifiers = lockFileData.lockFileMetadata.lockfileVersion
    .toString()
    .endsWith('inlineSpecifiers');

  const packageNames = Object.keys(lockFileData.dependencies);
  for (let i = 0; i < packageNames.length; i++) {
    const packageName = packageNames[i];
    const versions = Object.values(lockFileData.dependencies[packageName]);

    versions.forEach(({ packageMeta, resolution, engines }) => {
      (packageMeta as PackageMeta[]).forEach((meta) => {
        const { key, specifier } = meta;

        let version;
        if (inlineSpecifiers) {
          version = { specifier, version: key.slice(key.lastIndexOf('/') + 1) };
        } else {
          version = key.slice(key.lastIndexOf('/') + 1);

          if (specifier) {
            specifiers[packageName] = specifier;
          }
        }

        if (meta.isDependency) {
          dependencies[packageName] = version;
        }
        if (meta.isDevDependency) {
          devDependencies[packageName] = version;
        }
        packages[key] = {
          resolution,
          engines,
          ...meta.dependencyDetails,
        };
      });
    });
  }

  return {
    ...(lockFileData.lockFileMetadata as { lockfileVersion: string }),
    specifiers: sortObject(specifiers),
    dependencies: sortObject(dependencies),
    devDependencies: sortObject(devDependencies),
    packages: sortObject(packages),
  };
}

/**
 * Prunes the lock file data based on the list of packages and their transitive dependencies
 *
 * @param lockFileData
 * @returns
 */
export function prunePnpmLockFile(
  lockFileData: LockFileData,
  packages: string[]
): LockFileData {
  // todo(meeroslav): This functionality has not been implemented yet
  console.warn(
    'Pruning pnpm-lock.yaml is not yet implemented. Returning entire lock file'
  );
  return lockFileData;
}
