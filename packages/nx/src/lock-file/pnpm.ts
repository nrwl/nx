import {
  LockFileData,
  PackageDependency,
  PackageVersions,
} from './utils/lock-file-type';
import { dump, load } from '@zkochan/js-yaml';
import { isRootVersion, TransitiveLookupFunctionInput } from './utils/mapping';
import { generatePrunnedHash, hashString } from './utils/hashing';
import { satisfies } from 'semver';
import { PackageJsonDeps } from './utils/pruning';
import { sortObjectByKeys } from '../utils/object-sort';
import { pruneLockfile } from '@pnpm/prune-lockfile';

type PackageMeta = {
  key: string;
  specifier?: string;
  isDevDependency?: boolean;
  isDependency?: boolean;
  dependencyDetails: Record<string, Record<string, string>>;
  dev?: boolean;
  optional?: boolean;
  peer?: boolean;
};

type Dependencies = Record<string, Omit<PackageDependency, 'packageMeta'>>;

type VersionInfoWithInlineSpecifier = {
  version: string;
  specifier: string;
};

type PnpmLockFile = {
  lockfileVersion: number;
  specifiers?: Record<string, string>;
  dependencies?: Record<
    string,
    string | { version: string; specifier: string }
  >;
  devDependencies?: Record<
    string,
    string | { version: string; specifier: string }
  >;
  packages?: Dependencies;
  importers: Record<
    string,
    {
      specifiers: Record<string, string>;
      dependenciesMeta?: Record<string, any>;
      publishDirectory?: string;
    }
  >;

  time?: Record<string, string>; // e.g.   /@babel/core/7.19.6: '2022-10-20T09:03:36.074Z'
  overrides?: Record<string, string>; // js-yaml@^4.0.0: npm:@zkochan/js-yaml@0.0.6
  patchedDependencies?: Record<string, { path: string; hash: string }>; // e.g.  pkg@5.7.0: { path: 'patches/pkg@5.7.0.patch', hash: 'sha512-...' }
  neverBuiltDependencies?: string[]; // e.g.  ['core-js', 'level']
  onlyBuiltDependencies?: string[]; // e.g.  ['vite']
  packageExtensionsChecksum?: string; // e.g.  'sha512-...' DO NOT COPY TO PRUNED LOCKFILE
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

  return {
    dependencies: mapPackages(
      dependencies,
      devDependencies,
      specifiers,
      packages,
      metadata.lockfileVersion.toString().endsWith('inlineSpecifiers')
    ),
    lockFileMetadata: { ...metadata },
    hash: hashString(lockFile),
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

  const importers = {};

  Object.entries(packages).forEach(([key, value]) => {
    // create new key
    const { version, packageName, actualVersion } = parseVersionAndPackage(
      key,
      value,
      { dependencies, devDependencies }
    );
    const newKey = `${packageName}@${version.split('_')[0]}`;

    // construct packageMeta object
    const meta = mapMetaInformation(
      { dependencies, devDependencies, specifiers, importers },
      inlineSpecifiers,
      key,
      value,
      packageName,
      version
    );

    if (!mappedPackages[packageName]) {
      mappedPackages[packageName] = {};
    }
    if (mappedPackages[packageName][newKey]) {
      mappedPackages[packageName][newKey].packageMeta.push(meta);
    } else {
      const { dev, optional, peer, ...rest } = value;
      mappedPackages[packageName][newKey] = {
        ...rest,
        version: version.split('_')[0],
        ...(actualVersion && { actualVersion }),
        packageMeta: [meta],
      };
    }
  });

  Object.keys(mappedPackages).forEach((packageName) => {
    const versions = mappedPackages[packageName];
    const versionKeys = Object.keys(versions);

    if (versionKeys.length === 1) {
      versions[versionKeys[0]].rootVersion = true;
    } else {
      const rootVersionKey = versionKeys.find((v) =>
        isRootVersion(packageName, versions[v].version)
      );
      // this should never happen, but just in case
      if (rootVersionKey) {
        versions[rootVersionKey].rootVersion = true;
      }
    }
  });

  return mappedPackages;
}

function parseVersionAndPackage(
  key: string,
  value: Omit<PackageDependency, 'packageMeta'>,
  { dependencies, devDependencies }
): { version: string; packageName: string; actualVersion: string } {
  let version, packageName, actualVersion;

  const combinedDependencies = {
    ...(dependencies || {}),
    ...(devDependencies || {}),
  };
  // check if it's a special case package - npm:... or github:...
  packageName = Object.keys(combinedDependencies).find(
    (k) => combinedDependencies[k] === key
  );
  if (packageName) {
    version = key;
    actualVersion = value.version ?? key;
  } else {
    version = key.split('/').pop();
    packageName = key.slice(1, key.lastIndexOf('/'));
  }

  return { version, packageName, actualVersion };
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
  {
    dev,
    optional,
    peer,
    ...dependencyDetails
  }: Omit<PackageDependency, 'packageMeta'>,
  packageName: string,
  matchingVersion: string
): PackageMeta {
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
    ...(dev && { dev }),
    ...(optional && { optional }),
    ...(peer && { peer }),
    dependencyDetails: {
      ...(dependencyDetails.dependencies && {
        dependencies: dependencyDetails.dependencies,
      }),
      ...(dependencyDetails.peerDependencies && {
        peerDependencies: dependencyDetails.peerDependencies,
      }),
      ...(dependencyDetails.optionalDependencies && {
        optionalDependencies: dependencyDetails.optionalDependencies,
      }),
      ...(dependencyDetails.transitivePeerDependencies && {
        transitivePeerDependencies:
          dependencyDetails.transitivePeerDependencies,
      }),
    },
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
  const importers: Record<string, string> = {};
  const inlineSpecifiers = lockFileData.lockFileMetadata.lockfileVersion
    .toString()
    .endsWith('inlineSpecifiers');

  const packageNames = Object.keys(lockFileData.dependencies);
  for (let i = 0; i < packageNames.length; i++) {
    const packageName = packageNames[i];
    const versions = Object.values(lockFileData.dependencies[packageName]);

    versions.forEach(
      ({ packageMeta, version: _, actualVersion, rootVersion, ...rest }) => {
        (packageMeta as PackageMeta[]).forEach(
          ({
            key,
            specifier,
            isDependency,
            isDevDependency,
            dependencyDetails,
            dev,
            optional,
            peer,
          }) => {
            let version;
            if (inlineSpecifiers) {
              version = {
                specifier,
                version: actualVersion
                  ? key
                  : key.slice(key.lastIndexOf('/') + 1),
              };
            } else {
              version = actualVersion
                ? key
                : key.slice(key.lastIndexOf('/') + 1);

              if (specifier) {
                specifiers[packageName] = specifier;
              }
            }

            if (isDependency) {
              dependencies[packageName] = version;
            }
            if (isDevDependency) {
              devDependencies[packageName] = version;
            }
            packages[key] = {
              ...rest,
              ...(actualVersion &&
                actualVersion !== version && { version: actualVersion }),
              dev: !!dev,
              ...(optional && { optional }),
              ...(peer && { peer }),
              ...dependencyDetails,
            };
          }
        );
      }
    );
  }

  const { time, ...lockFileMetatada } = lockFileData.lockFileMetadata as Omit<
    PnpmLockFile,
    'specifiers' | 'importers' | 'devDependencies' | 'dependencies' | 'packages'
  >;

  return {
    ...(lockFileMetatada as { lockfileVersion: number }),
    ...(Object.keys(specifiers).length && {
      specifiers: sortObjectByKeys(specifiers),
    }),
    ...(Object.keys(dependencies).length && {
      dependencies: sortObjectByKeys(dependencies),
    }),
    ...(Object.keys(devDependencies).length && {
      devDependencies: sortObjectByKeys(devDependencies),
    }),
    ...(Object.keys(packages).length && {
      packages: sortObjectByKeys(packages),
    }),
    ...(Object.keys(importers).length && {
      importers: sortObjectByKeys(importers),
    }),
    time,
  };
}

/**
 * Returns matching version of the dependency
 */
export function transitiveDependencyPnpmLookup({
  packageName,
  versions,
  version,
}: TransitiveLookupFunctionInput): PackageDependency {
  const combinedDependency = Object.values(versions).find((v) =>
    v.packageMeta.some((m) => m.key === `/${packageName}/${version}`)
  );
  if (combinedDependency) {
    return combinedDependency;
  }
  // pnpm's dependencies always point to the exact version so this block is only for insurrance
  return Object.values(versions).find((v) => satisfies(v.version, version));
}

export function prunePnpmLockFileV2(
  lockFile: string,
  normalizedPackageJson: PackageJsonDeps
): PnpmLockFile {
  // TODO: Do these two changes at all times
  // TODO: we don't want to support all the possible lockfile versions
  const data: PnpmLockFile = convertFromLockfileFileMutable(load(lockFile));

  // TODO: revert from inline specifiers if needed
  return pruneLockfile(data as any, normalizedPackageJson, '.');
}

/**
 * Prunes the lock file data based on the list of packages and their transitive dependencies
 *
 * @param lockFileData
 * @returns
 */
export function prunePnpmLockFile(
  lockFileData: LockFileData,
  normalizedPackageJson: PackageJsonDeps
): LockFileData {
  const dependencies = pruneDependencies(
    lockFileData.dependencies,
    normalizedPackageJson
  );
  const prunedLockFileData = {
    lockFileMetadata: pruneMetadata(
      lockFileData.lockFileMetadata,
      dependencies
    ),
    dependencies,
    hash: generatePrunnedHash(lockFileData.hash, normalizedPackageJson),
  };
  return prunedLockFileData;
}

// iterate over packages to collect the affected tree of dependencies
function pruneDependencies(
  dependencies: LockFileData['dependencies'],
  normalizedPackageJson: PackageJsonDeps
): LockFileData['dependencies'] {
  const result: LockFileData['dependencies'] = {};

  Object.entries({
    ...normalizedPackageJson.dependencies,
    ...normalizedPackageJson.devDependencies,
    ...normalizedPackageJson.peerDependencies,
  }).forEach(([packageName, packageVersion]) => {
    if (dependencies[packageName]) {
      const [key, { packageMeta, ...value }] = Object.entries(
        dependencies[packageName]
      ).find(([_, v]) => v.rootVersion);
      result[packageName] = result[packageName] || {};
      const metaKey = value.actualVersion
        ? value.version
        : `/${packageName}/${value.version}`;
      const meta = packageMeta.find((m) => m.key.startsWith(metaKey));

      result[packageName][key] = Object.assign(value, {
        packageMeta: [
          {
            isDependency:
              !!normalizedPackageJson.dependencies?.[packageName] ||
              !!normalizedPackageJson.peerDependencies?.[packageName],
            isDevDependency:
              !!normalizedPackageJson.devDependencies?.[packageName],
            key: meta.key,
            specifier: packageVersion,
            dependencyDetails: meta.dependencyDetails,
          },
        ],
      });

      pruneTransitiveDependencies(
        [packageName],
        dependencies,
        result,
        result[packageName][key]
      );
    } else {
      console.warn(
        `Could not find ${packageName} in the lock file. Skipping...`
      );
    }
  });

  return result;
}

function pruneMetadata(
  lockFileMetadata: LockFileData['lockFileMetadata'],
  prunedDependencies: Record<string, PackageVersions>
): LockFileData['lockFileMetadata'] {
  // These should be removed from the lock file metadata since we don't have them in the package.json
  // overrides, patchedDependencies, neverBuiltDependencies, onlyBuiltDependencies, packageExtensionsChecksum
  return {
    lockfileVersion: lockFileMetadata.lockfileVersion,
    ...(lockFileMetadata.time && {
      time: pruneTime(lockFileMetadata.time, prunedDependencies),
    }),
  };
}

function pruneTime(
  time: Record<string, string>,
  prunedDependencies: Record<string, PackageVersions>
): Record<string, string> {
  const result: Record<string, string> = {};

  Object.entries(time).forEach(([key, value]) => {
    const packageName = key.slice(1, key.lastIndexOf('/'));
    const version = key.slice(key.lastIndexOf('/'));
    if (
      prunedDependencies[packageName] &&
      prunedDependencies[packageName][`${packageName}@${version}`]
    ) {
      result[key] = value;
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
  parent: PackageDependency
): void {
  Object.entries({
    ...parent.dependencies,
    ...parent.optionalDependencies,
  }).forEach(([packageName, version]: [string, string]) => {
    const versions = dependencies[packageName];
    if (
      parent.peerDependencies?.[packageName] &&
      parent.peerDependenciesMeta?.[packageName]?.optional
    ) {
      return;
    }
    if (versions) {
      const dependency = transitiveDependencyPnpmLookup({
        packageName,
        parentPackages,
        versions,
        version,
      });
      if (dependency) {
        if (!prunedDeps[packageName]) {
          prunedDeps[packageName] = {};
        }
        const { packageMeta, rootVersion, ...value } = dependency;
        const key = `${packageName}@${value.version}`;
        const meta = findPackageMeta(packageMeta, parentPackages);
        if (prunedDeps[packageName][key]) {
          // TODO not sure if this is important?
        } else {
          const packageMeta: PackageMeta = {
            key: meta.key,
            dependencyDetails: meta.dependencyDetails,
          };
          prunedDeps[packageName][key] = Object.assign(value, {
            rootVersion: false,
            packageMeta: [packageMeta],
          });
          if (
            parent.packageMeta[0].optional ||
            parent.optionalDependencies?.[packageName]
          ) {
            packageMeta.optional = true;
          }
          pruneTransitiveDependencies(
            [...parentPackages, packageName],
            dependencies,
            prunedDeps,
            prunedDeps[packageName][key]
          );
        }
      }
    }
  });
}

function findPackageMeta(
  packageMeta: PackageMeta[],
  parentPackages: string[]
): PackageMeta {
  const matchPackageVersionModifier =
    (version: string) => (packageName: string) => {
      const normalizedName = packageName.split('/').join('+');
      if (version.includes(`_${normalizedName}@`)) {
        return true;
      }
    };

  const nestedDependency =
    packageMeta.find((m) => {
      const version = m.key.split('/').pop();
      // it's modified by a single dependency
      // e.g. /@org/my-package/1.0.0_@babel+core@1.2.3
      return (
        version.includes('_') &&
        parentPackages.some(matchPackageVersionModifier(version))
      );
    }) ||
    // it's not modified by a single dependency but a mix of them
    // e.g. /@org/my-package/1.0.0_asfgasgasgasg
    packageMeta.find((m) => m.key.split('/').pop().includes('_'));
  if (nestedDependency) {
    return nestedDependency;
  }
  // otherwise it's a root dependency
  return packageMeta.find((m) => !m.key.split('/').pop().includes('_'));
}

/**
 * Reverts changes from the "forceSharedFormat" write option if necessary.
 */
function convertFromLockfileFileMutable(
  lockfileFile: PnpmLockFile
): PnpmLockFile {
  if (typeof lockfileFile?.['importers'] === 'undefined') {
    lockfileFile.importers = {
      '.': {
        specifiers: lockfileFile['specifiers'] ?? {},
        dependenciesMeta: lockfileFile['dependenciesMeta'],
        publishDirectory: lockfileFile['publishDirectory'],
      },
    };
    delete lockfileFile.specifiers;
    for (const depType of DEPENDENCIES_FIELDS) {
      if (lockfileFile[depType] != null) {
        lockfileFile.importers['.'][depType] = lockfileFile[depType];
        delete lockfileFile[depType];
      }
    }
  }
  return lockfileFile as PnpmLockFile;
}

export const DEPENDENCIES_FIELDS = [
  'optionalDependencies',
  'dependencies',
  'devDependencies',
];
