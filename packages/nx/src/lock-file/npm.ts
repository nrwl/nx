import { existsSync } from 'fs';
import { satisfies } from 'semver';
import { readJsonFile } from '../utils/fileutils';
import { output } from '../utils/output';
import { joinPathFragments } from '../utils/path';
import { workspaceRoot } from '../utils/workspace-root';
import { LockFileData, PackageDependency } from './utils/lock-file-type';
import { TransitiveLookupFunctionInput } from './utils/mapping';
import { hashString, generatePrunnedHash } from './utils/hashing';
import type { PackageJsonDeps } from './utils/pruning';

type PackageMeta = {
  path: string;
  optional?: boolean;
  dev?: boolean;
  [key: string]: any;
};

type Dependencies = Record<string, Omit<PackageDependency, 'packageMeta'>>;

type NpmDependencyV3 = {
  version: string;
  resolved: string;
  integrity: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional: boolean }>;
  dev?: boolean;
  peer?: boolean;
  devOptional?: boolean;
  optional?: boolean;
  name?: string;
};

type NpmDependencyV1 = {
  version: string;
  resolved: string;
  integrity: string;
  requires?: Record<string, string>;
  dependencies?: Record<string, NpmDependencyV1>;
  dev?: boolean;
  peer?: boolean;
  devOptional?: boolean;
  optional?: boolean;
  name?: string;
};

/**
 * Lock file version differences:
 * - v1 has only dependencies
 * - v2 has dependencies and packages for backwards compatibility
 * - v3 has only packages
 */
type NpmLockFile = {
  name?: string;
  version?: string;
  lockfileVersion: number;
  requires?: boolean;
  packages?: Record<string, NpmDependencyV3>;
  dependencies?: Record<string, NpmDependencyV1>;
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
    dependencies: mapPackages(dependencies, packages, metadata.lockfileVersion),
    lockFileMetadata: {
      metadata,
      ...(packages && { rootPackage: packages[''] }),
    },
    hash: hashString(lockFile),
  };
}

// Maps /node_modules/@abc/def with version 1.2.3 => @abc/def > @abc/dev@1.2.3
function mapPackages(
  dependencies: Record<string, NpmDependencyV1>,
  packages: Record<string, NpmDependencyV3>,
  lockfileVersion: number
): LockFileData['dependencies'] {
  const mappedPackages: LockFileData['dependencies'] = {};

  if (lockfileVersion === 1) {
    Object.entries(dependencies).forEach(([packageName, value]) => {
      const { newKey, packagePath } = prepareDependency(
        packageName,
        value,
        mappedPackages
      );

      mapPackageDependency(
        mappedPackages,
        packageName,
        newKey,
        packagePath,
        value,
        lockfileVersion,
        true
      );
      // we need to map the nested dependencies recursively
      mapPackageDependencies(
        mappedPackages,
        value.dependencies,
        packagePath,
        lockfileVersion
      );
    });
  } else {
    Object.entries(packages).forEach(([packagePath, value]) => {
      // we parse root package.json separately
      if (packagePath !== '') {
        const packageName = packagePath.split('node_modules/').pop();
        const { newKey } = prepareDependency(
          packageName,
          value,
          mappedPackages,
          undefined,
          packagePath
        );

        let dependency;
        if (lockfileVersion === 2) {
          const path = packagePath.split(/\/?node_modules\//).slice(1);

          let index = 1;
          dependency = dependencies[path[0]];
          while (index < path.length) {
            // the root lockfile might not match the nested project's lockfile
            // given path might not exist in the root lockfile
            if (
              dependency?.dependencies &&
              dependency.dependencies[path[index]]
            ) {
              dependency = dependency.dependencies[path[index]];
              index++;
            } else {
              break;
            }
          }
          // if versions are same, no need to track it further
          if (dependency && value.version === dependency.version) {
            dependency = undefined;
          }
        }

        mapPackageDependency(
          mappedPackages,
          packageName,
          newKey,
          packagePath,
          value,
          lockfileVersion,
          undefined,
          dependency
        );
      }
    });
  }

  return mappedPackages;
}

function prepareDependency(
  packageName: string,
  dependency: NpmDependencyV1 | NpmDependencyV3,
  mappedPackages: LockFileData['dependencies'],
  pathPrefix: string = '',
  path?: string
) {
  mappedPackages[packageName] = mappedPackages[packageName] || {};
  const version = dependency.integrity
    ? dependency.version
    : dependency.resolved;
  const newKey = packageName + '@' + version;
  const packagePath =
    path || pathPrefix
      ? `${pathPrefix}/node_modules/${packageName}`
      : `node_modules/${packageName}`;
  return { newKey, packagePath };
}

function mapPackageDependency(
  mappedPackages: LockFileData['dependencies'],
  packageName: string,
  key: string,
  packagePath: string,
  value: NpmDependencyV1 | Omit<PackageDependency, 'packageMeta'>,
  lockfileVersion: number,
  isRootVersion?: boolean,
  dependencyValue?: NpmDependencyV1
) {
  const { dev, peer, optional } = value;
  const packageMeta = {
    path: packagePath,
    dev,
    peer,
    optional,
  };

  const rootVersion =
    isRootVersion ?? packagePath.split('/node_modules/').length === 1;

  if (!mappedPackages[packageName][key] || rootVersion) {
    // const packageDependencies = lockfileVersion === 1 ? requires : dependencies;

    if (lockfileVersion === 1) {
      const { requires, ...rest } = value;
      if (requires) {
        rest.dependencies = requires;
      }
      value = rest;
    }

    mappedPackages[packageName][key] = {
      ...(value as Omit<PackageDependency, 'packageMeta'>),
      ...(!value.integrity &&
        value.version && {
          actualVersion: value.version,
          version: value.resolved,
        }),
      ...(value.integrity &&
        dependencyValue && {
          actualVersion: value.version,
          version: dependencyValue.version,
        }),
      ...(dependencyValue && { dependencyValue }),
      packageMeta: [],
      rootVersion,
    };
  }

  mappedPackages[packageName][key].packageMeta.push(packageMeta);
}

function mapPackageDependencies(
  mappedPackages: LockFileData['dependencies'],
  dependencies: Record<string, NpmDependencyV1>,
  parentPath: string,
  lockfileVersion: number
): void {
  if (!dependencies) {
    return;
  }

  Object.entries(dependencies).forEach(([packageName, value]) => {
    const { newKey, packagePath } = prepareDependency(
      packageName,
      value,
      mappedPackages,
      parentPath
    );

    mapPackageDependency(
      mappedPackages,
      packageName,
      newKey,
      packagePath,
      value,
      lockfileVersion,
      false
    );

    mapPackageDependencies(
      mappedPackages,
      value.dependencies,
      packagePath,
      lockfileVersion
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
  const notV1 = lockFileData.lockFileMetadata.metadata.lockfileVersion > 1;
  const notV3 = lockFileData.lockFileMetadata.metadata.lockfileVersion < 3;

  // initialize the lockfile collections
  const dependencies = {};
  const packages: Dependencies = {
    ...(notV1 && { '': lockFileData.lockFileMetadata.rootPackage }),
  };

  const keys = Object.keys(lockFileData.dependencies);
  for (let i = 0; i < keys.length; i++) {
    const packageName = keys[i];
    const packageVersions = lockFileData.dependencies[packageName];
    const values = Object.values(packageVersions);

    values.forEach((value) => {
      if (notV1) {
        unmapPackage(packages, value);
      }
      if (notV3) {
        unmapDependencies(dependencies, packageName, value);
      }
    });
  }

  // generate package lock JSON
  const lockFileJson: NpmLockFile = {
    ...lockFileData.lockFileMetadata.metadata,
    ...(notV1 && {
      packages: sortObject(packages),
    }),
    ...(notV3 && { dependencies: sortDependencies(dependencies) }),
  };

  return JSON.stringify(lockFileJson, null, 2) + '\n';
}

function sortObject(packages: Dependencies): Dependencies | undefined {
  const keys = Object.keys(packages);
  if (keys.length === 0) {
    return;
  }

  keys.sort((a, b) => a.localeCompare(b));

  const result: Dependencies = {};
  keys.forEach((key) => {
    result[key] = packages[key];
  });
  return result;
}

// remapping the package back to package-lock format
function unmapPackage(packages: Dependencies, dependency: PackageDependency) {
  const {
    packageMeta,
    rootVersion,
    version,
    actualVersion,
    resolved,
    integrity,
    dev,
    peer,
    optional,
    dependencyValue,
    ...value
  } = dependency;
  // we need to decompose value, to achieve particular field ordering

  for (let i = 0; i < packageMeta.length; i++) {
    const { path, dev, peer, optional } = packageMeta[i];
    // we are sorting the properties to get as close as possible to the original package-lock.json
    packages[path] = {
      version: actualVersion || version,
      resolved,
      integrity,
      dev,
      peer,
      optional,
      ...value,
    };
  }
}

function unmapDependencies(
  dependencies: Record<string, NpmDependencyV1 | NpmDependencyV3>,
  packageName: string,
  { packageMeta, ...value }: PackageDependency & { packageMeta: PackageMeta[] }
): void {
  const { version, resolved, integrity, devOptional, dependencyValue, from } =
    value;

  for (let i = 0; i < packageMeta.length; i++) {
    const { path, dev, optional, peer } = packageMeta[i];
    const projectPath = path.split('node_modules/').slice(1);

    const requires = unmapDependencyRequires(value);
    const innerDeps = getProjectNodeAndEnsureParentHierarchy(
      projectPath,
      dependencies as Record<string, NpmDependencyV1>
    );

    // sorting fields to match package-lock structure
    innerDeps[packageName] = dependencyValue || {
      version,
      resolved,
      integrity,
      from,
      dev,
      devOptional,
      optional,
      peer,
      requires,
      ...innerDeps[packageName],
    };
  }
}

// generates/ensures entire parent hierarchy exists for the given project path
// returns pointer to last project in the path
function getProjectNodeAndEnsureParentHierarchy(
  projects: string[],
  dependencies: Record<string, NpmDependencyV1>
) {
  while (projects.length > 1) {
    const parentName = projects.shift().replace(/\/$/, '');
    if (!dependencies[parentName]) {
      dependencies[parentName] = {} as NpmDependencyV1;
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
  const sortedKeys = Object.keys(dependencies).sort((a, b) =>
    a.localeCompare(b)
  );
  const result = {};
  for (let i = 0; i < sortedKeys.length; i++) {
    const key = sortedKeys[i];
    result[key] = dependencies[key];
  }
  return result;
}

// recursively sort dependencies
function sortDependencies(
  unsortedDependencies: Record<string, NpmDependencyV1>
): Record<string, NpmDependencyV1> {
  const dependencies = {};
  const sortedKeys = Object.keys(unsortedDependencies).sort((a, b) =>
    a.localeCompare(b)
  );

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
 * Returns matching version of the dependency
 */
export function transitiveDependencyNpmLookup({
  packageName,
  parentPackages,
  versions,
  version,
}: TransitiveLookupFunctionInput): PackageDependency {
  const packageDependencies = Object.values(versions);

  for (let i = 0; i < packageDependencies.length; i++) {
    if (satisfies(packageDependencies[i].version, version)) {
      const packageMeta = packageDependencies[i].packageMeta.find((p) =>
        isPathMatching(p.path, packageName, parentPackages)
      );
      if (packageMeta) {
        return {
          ...packageDependencies[i],
          packageMeta: [packageMeta],
        };
      }
    }
  }

  // otherwise return the root version
  return Object.values(versions).find((v) => v.rootVersion);
}

function isPathMatching(
  path: string,
  packageName: string,
  parentPackages: string[]
): boolean {
  const packages = path.split(/\/?node_modules\//).slice(1);
  if (packages[packages.length - 1] !== packageName) {
    return false;
  }
  const locations = parentPackages
    .map((p) => packages.indexOf(p))
    .filter((p) => p !== -1);
  if (locations.length === 0) {
    return false;
  }
  for (let i = 0; i < locations.length - 2; i++) {
    if (locations[i] > locations[i + 1]) {
      return false;
    }
  }
  return true;
}

/**
 * Prunes the lock file data based on the list of packages and their transitive dependencies
 *
 * @param lockFileData
 * @returns
 */
export function pruneNpmLockFile(
  lockFileData: LockFileData,
  normalizedPackageJson: PackageJsonDeps
): LockFileData {
  const isV1 = lockFileData.lockFileMetadata.metadata.lockfileVersion === 1;

  // NPM V1 does not track full dependency list in the lock file,
  // so we can't reuse the lock file to generate a new one
  if (isV1) {
    output.warn({
      title: 'Pruning v1 lock file',
      bodyLines: [
        `If your "node_modules" are not in sync with the lock file, you might get inaccurate results.`,
        `Run "npm ci" to ensure your installed packages are synchronized or upgrade to NPM v7+ to benefit from the new lock file format`,
      ],
    });
  }

  const dependencies = pruneDependencies(
    lockFileData.dependencies,
    normalizedPackageJson,
    isV1
  );
  const lockFileMetadata = {
    metadata: {
      ...lockFileData.lockFileMetadata.metadata,
      version:
        normalizedPackageJson.version || lockFileData.lockFileMetadata?.version,
    },
    ...pruneRootPackage(lockFileData, normalizedPackageJson),
  };
  let prunedLockFileData: LockFileData;
  prunedLockFileData = {
    dependencies,
    lockFileMetadata,
    hash: generatePrunnedHash(lockFileData.hash, normalizedPackageJson),
  };
  return prunedLockFileData;
}

function pruneRootPackage(
  lockFileData: LockFileData,
  packageJson: PackageJsonDeps
): Record<string, any> {
  if (lockFileData.lockFileMetadata.metadata.lockfileVersion === 1) {
    return undefined;
  }
  const rootPackage = packageJson;

  return { rootPackage };
}

type PeerDepsInfo = Record<
  string,
  {
    parentPackages: string[];
    dependency: PackageDependency;
    packageMeta: PackageMeta;
    packageName: string;
    key: string;
  }
>;

// iterate over packages to collect the affected tree of dependencies
function pruneDependencies(
  dependencies: LockFileData['dependencies'],
  normalizedPackageJson: PackageJsonDeps,
  isV1?: boolean
): LockFileData['dependencies'] {
  const result: LockFileData['dependencies'] = {};

  const peerDependenciesToPrune: PeerDepsInfo = {};

  Object.keys({
    ...normalizedPackageJson.dependencies,
    ...normalizedPackageJson.devDependencies,
    ...normalizedPackageJson.peerDependencies,
  }).forEach((packageName) => {
    if (dependencies[packageName]) {
      const [key, { packageMeta, dev: _d, peer: _p, optional: _o, ...value }] =
        Object.entries(dependencies[packageName]).find(
          ([_, v]) => v.rootVersion
        );

      const dev = normalizedPackageJson.devDependencies?.[packageName];
      const peer = normalizedPackageJson.peerDependencies?.[packageName];
      const optional =
        normalizedPackageJson.peerDependenciesMeta?.[packageName]?.optional;
      const modifier = peer
        ? 'peer'
        : optional
        ? 'optional'
        : dev
        ? 'dev'
        : undefined;

      result[packageName] = result[packageName] || {};
      result[packageName][key] = Object.assign(value, {
        packageMeta: [
          {
            path: `node_modules/${packageName}`,
            ...(dev ? { dev } : {}),
            ...(optional ? { optional } : {}),
            ...(peer ? { peer } : {}),
          },
        ],
      });

      pruneTransitiveDependencies(
        [packageName],
        dependencies,
        result,
        result[packageName][key],
        isV1,
        modifier,
        peerDependenciesToPrune
      );
    } else {
      console.warn(
        `Could not find ${packageName} in the lock file. Skipping...`
      );
    }
  });

  // add all peer dependencies
  Object.values(peerDependenciesToPrune).forEach(
    ({ parentPackages, dependency, packageMeta, packageName, key }) => {
      addPrunedDependency(
        parentPackages,
        dependencies,
        result,
        dependency,
        packageMeta,
        packageName,
        key,
        isV1
      );
    }
  );

  return result;
}

// find all transitive dependencies of already pruned packages
// and adds them to the collection
// recursively prune their dependencies
function pruneTransitiveDependencies(
  parentPackages: string[],
  dependencies: LockFileData['dependencies'],
  prunedDeps: LockFileData['dependencies'],
  value: PackageDependency,
  isV1?: boolean,
  modifier?: 'dev' | 'optional' | 'peer',
  peerDependenciesToPrune?: PeerDepsInfo
): void {
  let packageJSON: PackageDependency;
  if (isV1) {
    const pathToPackageJSON = joinPathFragments(
      workspaceRoot,
      value.packageMeta[0].path,
      'package.json'
    );
    // if node_modules are our of sync with lock file, we might not have the package.json
    if (existsSync(pathToPackageJSON)) {
      packageJSON = readJsonFile(pathToPackageJSON);
    }
  }
  if (
    !value.dependencies &&
    !value.peerDependencies &&
    !packageJSON?.peerDependencies
  ) {
    return;
  }

  Object.entries({
    ...value.dependencies,
    ...value.peerDependencies,
    ...value.optionalDependencies,
    ...packageJSON?.peerDependencies,
  }).forEach(([packageName, version]: [string, string]) => {
    const versions = dependencies[packageName];
    if (versions) {
      const dependency = transitiveDependencyNpmLookup({
        packageName,
        parentPackages,
        versions,
        version,
      });
      if (dependency) {
        // dev/optional/peer dependencies can be changed during the pruning process
        // so we need to update them
        if (!prunedDeps[packageName]) {
          prunedDeps[packageName] = {};
        }
        const key = `${packageName}@${dependency.version}`;

        const packageMeta = setPackageMetaModifiers(
          packageName,
          dependency,
          packageJSON || value,
          modifier
        );
        // initially will collect only non-peer dependencies
        // this gives priority to direct dependencies over peer ones
        if (
          peerDependenciesToPrune &&
          (value.peerDependencies?.[packageName] ||
            packageJSON?.peerDependencies?.[packageName])
        ) {
          if (
            value.peerDependencies?.[packageName] &&
            value.peerDependenciesMeta?.[packageName]?.optional
          ) {
            return;
          }
          if (
            packageJSON?.peerDependencies?.[packageName] &&
            packageJSON.peerDependenciesMeta?.[packageName]?.optional
          ) {
            return;
          }
          peerDependenciesToPrune[key] = peerDependenciesToPrune[key] || {
            parentPackages,
            dependency,
            packageMeta,
            packageName,
            key,
          };
          return;
        }
        addPrunedDependency(
          parentPackages,
          dependencies,
          prunedDeps,
          dependency,
          packageMeta,
          packageName,
          key,
          isV1,
          peerDependenciesToPrune
        );
      }
    }
  });
}

function addPrunedDependency(
  parentPackages,
  dependencies: LockFileData['dependencies'],
  prunedDeps: LockFileData['dependencies'],
  dependency: PackageDependency,
  packageMeta: PackageMeta,
  packageName: string,
  key: string,
  isV1?: boolean,
  peerDependenciesToPrune?: PeerDepsInfo
) {
  if (prunedDeps[packageName][key]) {
    const currentMeta = prunedDeps[packageName][key].packageMeta;

    if (!currentMeta.find((p) => p.path === dependency.packageMeta[0].path)) {
      currentMeta.push(packageMeta);
      currentMeta.sort();
    }
  } else {
    dependency.packageMeta = [packageMeta];
    prunedDeps[packageName][key] = dependency;
    // recurively collect dependencies
    pruneTransitiveDependencies(
      [...parentPackages, packageName],
      dependencies,
      prunedDeps,
      prunedDeps[packageName][key],
      isV1,
      getModifier(packageMeta),
      peerDependenciesToPrune
    );
  }
}

function getModifier(
  packageMeta: PackageMeta
): 'dev' | 'optional' | 'peer' | undefined {
  if (packageMeta.dev) {
    return 'dev';
  } else if (packageMeta.optional) {
    return 'optional';
  } else if (packageMeta.peer) {
    return 'peer';
  }
}

function setPackageMetaModifiers(
  packageName: string,
  dependency: PackageDependency,
  parent: PackageDependency,
  modifier?: 'dev' | 'optional' | 'peer'
): PackageMeta {
  const packageMeta: PackageMeta = { path: dependency.packageMeta[0].path };

  if (parent.devDependencies?.[packageName]) {
    packageMeta.dev = true;
  } else if (dependency.optional) {
    packageMeta.optional = true;
  } else if (parent.optionalDependencies?.[packageName]) {
    packageMeta.optional = true;
  } else if (parent.peerDependencies?.[packageName]) {
    packageMeta.peer = true;
  } else if (modifier === 'dev') {
    packageMeta.dev = true;
  } else if (modifier === 'optional') {
    packageMeta.optional = true;
  }
  // peer is carried over from the parent
  if (modifier === 'peer') {
    packageMeta.peer = true;
  }

  return packageMeta;
}
