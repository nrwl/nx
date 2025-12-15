import type {
  Lockfile,
  PackageSnapshot,
  PackageSnapshots,
  ProjectSnapshot,
} from '@pnpm/lockfile-types';
import {
  isV5Syntax,
  loadPnpmHoistedDepsDefinition,
  parseAndNormalizePnpmLockfile,
  stringifyToPnpmYaml,
} from './utils/pnpm-normalizer';
import {
  getHoistedPackageVersion,
  invertObject,
  NormalizedPackageJson,
} from './utils/package-json';
import { sortObjectByKeys } from '../../../utils/object-sort';
import {
  RawProjectGraphDependency,
  validateDependency,
} from '../../../project-graph/project-graph-builder';
import {
  DependencyType,
  ProjectGraph,
  ProjectGraphExternalNode,
} from '../../../config/project-graph';
import { hashArray } from '../../../hasher/file-hasher';
import { CreateDependenciesContext } from '../../../project-graph/plugins';
import { getCatalogManager } from '../../../utils/catalog';
import { findNodeMatchingVersion } from './project-graph-pruning';
import { join } from 'path';
import { getWorkspacePackagesFromGraph } from '../utils/get-workspace-packages-from-graph';
let currentLockFileHash: string;

let parsedLockFile: Lockfile;

function parsePnpmLockFile(
  lockFileContent: string,
  lockFileHash: string
): Lockfile {
  if (lockFileHash === currentLockFileHash) {
    return parsedLockFile;
  }

  const results = parseAndNormalizePnpmLockfile(lockFileContent);
  parsedLockFile = results;
  currentLockFileHash = lockFileHash;
  return results;
}

export function getPnpmLockfileNodes(
  lockFileContent: string,
  lockFileHash: string
): {
  nodes: Record<string, ProjectGraphExternalNode>;
  keyMap: Map<string, Set<ProjectGraphExternalNode>>;
} {
  const data = parsePnpmLockFile(lockFileContent, lockFileHash);
  if (+data.lockfileVersion.toString() >= 10) {
    console.warn(
      'Nx was tested only with pnpm lockfile version 5-9. If you encounter any issues, please report them and downgrade to older version of pnpm.'
    );
  }
  const isV5 = isV5Syntax(data);
  return getNodes(data, isV5);
}

export function getPnpmLockfileDependencies(
  lockFileContent: string,
  lockFileHash: string,
  ctx: CreateDependenciesContext,
  keyMap: Map<string, Set<ProjectGraphExternalNode>>
) {
  const data = parsePnpmLockFile(lockFileContent, lockFileHash);
  if (+data.lockfileVersion.toString() >= 10) {
    console.warn(
      'Nx was tested only with pnpm lockfile version 5-9. If you encounter any issues, please report them and downgrade to older version of pnpm.'
    );
  }
  const isV5 = isV5Syntax(data);
  return getDependencies(data, keyMap, isV5, ctx);
}

const cachedInvertedRecords = new Map<string, Record<string, string>>();
function matchPropValue(
  record: Record<string, string>,
  key: string,
  originalPackageName: string,
  recordName: string
): string | undefined {
  if (!record) {
    return undefined;
  }
  if (!cachedInvertedRecords.has(recordName)) {
    cachedInvertedRecords.set(recordName, invertObject(record));
  }
  const packageName = cachedInvertedRecords.get(recordName)[key];
  if (packageName) {
    return packageName;
  }
  // check if non-aliased name is found
  if (
    record[originalPackageName] &&
    key.startsWith(`/${originalPackageName}/${record[originalPackageName]}`)
  ) {
    return originalPackageName;
  }
}

function matchedDependencyName(
  importer: Partial<PackageSnapshot>,
  key: string,
  originalPackageName: string
): string | undefined {
  return (
    matchPropValue(
      importer.dependencies,
      key,
      originalPackageName,
      'dependencies'
    ) ||
    matchPropValue(
      importer.optionalDependencies,
      key,
      originalPackageName,
      'optionalDependencies'
    ) ||
    matchPropValue(
      importer.peerDependencies,
      key,
      originalPackageName,
      'peerDependencies'
    )
  );
}

function createHashFromSnapshot(snapshot: PackageSnapshot) {
  return (
    snapshot.resolution?.['integrity'] ||
    (snapshot.resolution?.['tarball']
      ? hashArray([snapshot.resolution['tarball']])
      : undefined)
  );
}

function isAliasVersion(depVersion: string) {
  return depVersion.startsWith('/') || depVersion.includes('@');
}

function getNodes(
  data: Lockfile,
  isV5: boolean
): {
  nodes: Record<string, ProjectGraphExternalNode>;
  keyMap: Map<string, Set<ProjectGraphExternalNode>>;
} {
  const keyMap = new Map<string, Set<ProjectGraphExternalNode>>();
  const nodes: Map<string, Map<string, ProjectGraphExternalNode>> = new Map();

  const maybeAliasedPackageVersions = new Map<string, string>(); // <version, alias>

  if (data.importers['.'].optionalDependencies) {
    for (const [depName, depVersion] of Object.entries(
      data.importers['.'].optionalDependencies
    )) {
      if (isAliasVersion(depVersion)) {
        maybeAliasedPackageVersions.set(depVersion, depName);
      }
    }
  }
  if (data.importers['.'].devDependencies) {
    for (const [depName, depVersion] of Object.entries(
      data.importers['.'].devDependencies
    )) {
      if (isAliasVersion(depVersion)) {
        maybeAliasedPackageVersions.set(depVersion, depName);
      }
    }
  }
  if (data.importers['.'].dependencies) {
    for (const [depName, depVersion] of Object.entries(
      data.importers['.'].dependencies
    )) {
      if (isAliasVersion(depVersion)) {
        maybeAliasedPackageVersions.set(depVersion, depName);
      }
    }
  }

  const packageNames = new Set<{
    key: string;
    packageName: string;
    hash?: string;
    alias?: boolean;
  }>();
  let packageNameObj;
  for (const [key, snapshot] of Object.entries(data.packages)) {
    const originalPackageName = extractNameFromKey(key, isV5);
    if (!originalPackageName) {
      continue;
    }
    const hash = createHashFromSnapshot(snapshot);
    // snapshot already has a name
    if (snapshot.name) {
      packageNameObj = {
        key,
        packageName: snapshot.name,
        hash,
      };
    }
    const rootDependencyName =
      matchedDependencyName(data.importers['.'], key, originalPackageName) ||
      matchedDependencyName(
        data.importers['.'],
        `/${key}`,
        originalPackageName
      ) ||
      // only root importers have devDependencies
      matchPropValue(
        data.importers['.'].devDependencies,
        key,
        originalPackageName,
        'devDependencies'
      ) ||
      matchPropValue(
        data.importers['.'].devDependencies,
        `/${key}`,
        originalPackageName,
        'devDependencies'
      );
    if (rootDependencyName) {
      packageNameObj = {
        key,
        packageName: rootDependencyName,
        hash: createHashFromSnapshot(snapshot),
      };
    }

    if (!snapshot.name && !rootDependencyName) {
      packageNameObj = {
        key,
        packageName: originalPackageName,
        hash: createHashFromSnapshot(snapshot),
      };
    }

    if (snapshot.peerDependencies) {
      for (const [depName, depVersion] of Object.entries(
        snapshot.peerDependencies
      )) {
        if (isAliasVersion(depVersion)) {
          maybeAliasedPackageVersions.set(depVersion, depName);
        }
      }
    }
    if (snapshot.optionalDependencies) {
      for (const [depName, depVersion] of Object.entries(
        snapshot.optionalDependencies
      )) {
        if (isAliasVersion(depVersion)) {
          maybeAliasedPackageVersions.set(depVersion, depName);
        }
      }
    }
    if (snapshot.dependencies) {
      for (const [depName, depVersion] of Object.entries(
        snapshot.dependencies
      )) {
        if (isAliasVersion(depVersion)) {
          maybeAliasedPackageVersions.set(depVersion, depName);
        }
      }
    }

    const aliasedDep = maybeAliasedPackageVersions.get(`/${key}`);
    if (aliasedDep) {
      packageNameObj = {
        key,
        packageName: aliasedDep,
        hash,
        alias: true,
      };
    }
    packageNames.add(packageNameObj);
    const localAlias = maybeAliasedPackageVersions.get(key);
    if (localAlias) {
      packageNameObj = {
        key,
        packageName: localAlias,
        hash,
        alias: true,
      };
      packageNames.add(packageNameObj);
    }
  }

  for (const { key, packageName, hash, alias } of packageNames) {
    const rawVersion = findVersion(key, packageName, isV5, alias);
    if (!rawVersion) {
      continue;
    }
    const version = parseBaseVersion(rawVersion, isV5);
    if (!version) {
      continue;
    }

    if (!nodes.has(packageName)) {
      nodes.set(packageName, new Map());
    }

    if (!nodes.get(packageName).has(version)) {
      const node: ProjectGraphExternalNode = {
        type: 'npm',
        name:
          version && !version.startsWith('npm:')
            ? `npm:${packageName}@${version}`
            : `npm:${packageName}`,
        data: {
          version,
          packageName,
          hash: hash ?? hashArray([packageName, version]),
        },
      };
      nodes.get(packageName).set(version, node);
      if (!keyMap.has(key)) {
        keyMap.set(key, new Set([node]));
      } else {
        keyMap.get(key).add(node);
      }
    } else {
      const node = nodes.get(packageName).get(version);
      if (!keyMap.has(key)) {
        keyMap.set(key, new Set([node]));
      } else {
        keyMap.get(key).add(node);
      }
    }
  }

  const hoistedDeps = loadPnpmHoistedDepsDefinition();

  // Pre-build packageName -> key index for O(1) lookup instead of O(n) find() per package
  const hoistedKeysByPackage = new Map<string, string>();
  for (const key of Object.keys(hoistedDeps)) {
    if (key.startsWith('/')) {
      // Extract package name from key format: /{packageName}/{version}... or /@scope/name/{version}...
      const withoutSlash = key.slice(1);
      const slashIndex = withoutSlash.startsWith('@')
        ? withoutSlash.indexOf('/', withoutSlash.indexOf('/') + 1)
        : withoutSlash.indexOf('/');
      if (slashIndex > 0) {
        const pkgName = withoutSlash.slice(0, slashIndex);
        if (!hoistedKeysByPackage.has(pkgName)) {
          hoistedKeysByPackage.set(pkgName, key);
        }
      }
    }
  }

  const results: Record<string, ProjectGraphExternalNode> = {};

  for (const [packageName, versionMap] of nodes.entries()) {
    let hoistedNode: ProjectGraphExternalNode;
    if (versionMap.size === 1) {
      hoistedNode = versionMap.values().next().value;
    } else {
      const hoistedVersion = getHoistedVersion(
        packageName,
        isV5,
        hoistedKeysByPackage
      );
      hoistedNode = versionMap.get(hoistedVersion);
    }
    if (hoistedNode) {
      hoistedNode.name = `npm:${packageName}`;
    }

    versionMap.forEach((node) => {
      results[node.name] = node;
    });
  }
  return { nodes: results, keyMap };
}

function getHoistedVersion(
  packageName: string,
  isV5: boolean,
  hoistedKeysByPackage: Map<string, string>
): string {
  let version = getHoistedPackageVersion(packageName);

  if (!version) {
    // Use pre-built index for O(1) lookup
    const key = hoistedKeysByPackage.get(packageName);
    if (key) {
      version = parseBaseVersion(getVersion(key.slice(1), packageName), isV5);
    } else {
      // pnpm might not hoist every package
      // similarly those packages will not be available to be used via import
      return;
    }
  }

  return version;
}

function getDependencies(
  data: Lockfile,
  keyMap: Map<string, Set<ProjectGraphExternalNode>>,
  isV5: boolean,
  ctx: CreateDependenciesContext
): RawProjectGraphDependency[] {
  const results: RawProjectGraphDependency[] = [];
  Object.keys(data.packages).forEach((key) => {
    const snapshot = data.packages[key];
    const nodes = keyMap.get(key);
    nodes.forEach((node) => {
      [snapshot.dependencies, snapshot.optionalDependencies].forEach(
        (section) => {
          if (section) {
            Object.keys(section).forEach((name) => {
              const versionRange = section[name];
              const version = parseBaseVersion(
                findVersion(versionRange, name, isV5),
                isV5
              );
              const target =
                ctx.externalNodes[`npm:${name}@${version}`] ||
                ctx.externalNodes[`npm:${name}`];
              if (target) {
                const dep: RawProjectGraphDependency = {
                  source: node.name,
                  target: target.name,
                  type: DependencyType.static,
                };
                validateDependency(dep, ctx);
                results.push(dep);
              }
            });
          }
        }
      );
    });
  });

  return results;
}

function parseBaseVersion(rawVersion: string, isV5: boolean): string {
  return isV5 ? rawVersion.split('_')[0] : rawVersion.split('(')[0];
}

export function stringifyPnpmLockfile(
  graph: ProjectGraph,
  rootLockFileContent: string,
  packageJson: NormalizedPackageJson,
  workspaceRoot: string
): string {
  const data = parseAndNormalizePnpmLockfile(rootLockFileContent);
  const { lockfileVersion, packages, importers } = data;

  const { snapshot: rootSnapshot, importers: requiredImporters } =
    mapRootSnapshot(
      packageJson,
      importers,
      packages,
      graph,
      +lockfileVersion,
      workspaceRoot
    );
  const snapshots = mapSnapshots(
    data.packages,
    graph.externalNodes,
    +lockfileVersion
  );

  const workspaceDependencyImporters: Record<string, ProjectSnapshot> = {};
  for (const [packageName, importerPath] of Object.entries(requiredImporters)) {
    const baseImporter = importers[importerPath];
    if (baseImporter) {
      workspaceDependencyImporters[`workspace_modules/${packageName}`] =
        baseImporter;
    }
  }

  const output: Lockfile = {
    ...data,
    lockfileVersion,
    importers: {
      '.': rootSnapshot,
      ...workspaceDependencyImporters,
    },
    packages: sortObjectByKeys(snapshots),
  };

  return stringifyToPnpmYaml(output);
}

function mapSnapshots(
  packages: PackageSnapshots,
  nodes: Record<string, ProjectGraphExternalNode>,
  lockfileVersion: number
): PackageSnapshots {
  const result: PackageSnapshots = {};
  Object.values(nodes).forEach((node) => {
    const matchedKeys = findOriginalKeys(packages, node, lockfileVersion, {
      returnFullKey: true,
    });

    // the package manager doesn't check for types of dependencies
    // so we can safely set all to prod
    matchedKeys.forEach(([key, snapshot]) => {
      if (lockfileVersion >= 9) {
        delete snapshot['dev'];
        result[key] = snapshot;
      } else {
        snapshot['dev'] = false; // all dependencies are prod
        remapDependencies(snapshot);
        if (snapshot.resolution?.['tarball']) {
          // tarballs are not prefixed with /
          result[key] = snapshot;
        } else {
          result[`/${key}`] = snapshot;
        }
      }
    });
  });
  return result;
}

function remapDependencies(snapshot: PackageSnapshot) {
  [
    'dependencies',
    'optionalDependencies',
    'devDependencies',
    'peerDependencies',
  ].forEach((depType) => {
    if (snapshot[depType]) {
      for (const [packageName, version] of Object.entries(
        snapshot[depType] as Record<string, string>
      )) {
        if (version.match(/^[a-zA-Z]+.*/)) {
          // remap packageName@version to packageName/version
          snapshot[depType][packageName] = `/${version.replace(
            /([a-zA-Z].+)@/,
            '$1/'
          )}`;
        }
      }
    }
  });
}

function findOriginalKeys(
  packages: PackageSnapshots,
  { data: { packageName, version } }: ProjectGraphExternalNode,
  lockfileVersion: number,
  { returnFullKey }: { returnFullKey?: boolean } = {}
): Array<[string, PackageSnapshot]> {
  const matchedKeys = [];
  for (const key of Object.keys(packages)) {
    const snapshot = packages[key];

    // tarball package
    if (
      key.startsWith(`${packageName}@${version}`) &&
      snapshot.resolution?.['tarball']
    ) {
      matchedKeys.push([getVersion(key, packageName), snapshot]);
    }
    // standard package
    if (lockfileVersion < 6 && key.startsWith(`${packageName}/${version}`)) {
      matchedKeys.push([
        returnFullKey ? key : getVersion(key, packageName),
        snapshot,
      ]);
    }
    if (
      lockfileVersion >= 6 &&
      lockfileVersion < 9 &&
      key.startsWith(`${packageName}@${version}`)
    ) {
      matchedKeys.push([
        // we need to replace the @ with / for v5-7 syntax because the dpParse function expects old format
        returnFullKey
          ? key.replace(
              `${packageName}@${version}`,
              `${packageName}/${version}`
            )
          : getVersion(key, packageName),
        snapshot,
      ]);
    }
    if (lockfileVersion >= 9 && key.startsWith(`${packageName}@${version}`)) {
      matchedKeys.push([
        returnFullKey ? key : getVersion(key, packageName),
        snapshot,
      ]);
    }
    // alias package
    if (versionIsAlias(key, version, lockfileVersion)) {
      if (lockfileVersion >= 9) {
        // no postprocessing needed for v9
        matchedKeys.push([key, snapshot]);
      } else {
        // for root specifiers we need to ensure alias is prefixed with /
        const prefixedKey = returnFullKey ? key : `/${key}`;
        const mappedKey = prefixedKey.replace(/(\/?..+)@/, '$1/');
        matchedKeys.push([mappedKey, snapshot]);
      }
    }
  }
  return matchedKeys;
}

// check if version has a form of npm:packageName@version and
// key starts with /packageName/version
function versionIsAlias(
  key: string,
  versionExpr: string,
  lockfileVersion: number
): boolean {
  const PREFIX = 'npm:';
  if (!versionExpr.startsWith(PREFIX)) return false;

  const indexOfVersionSeparator = versionExpr.indexOf('@', PREFIX.length + 1);
  const packageName = versionExpr.slice(PREFIX.length, indexOfVersionSeparator);
  const version = versionExpr.slice(indexOfVersionSeparator + 1);

  return lockfileVersion < 6
    ? key.startsWith(`${packageName}/${version}`)
    : key.startsWith(`${packageName}@${version}`);
}

function mapRootSnapshot(
  packageJson: NormalizedPackageJson,
  rootImporters: Record<string, ProjectSnapshot>,
  packages: PackageSnapshots,
  graph: ProjectGraph,
  lockfileVersion: number,
  workspaceRoot: string
) {
  const workspaceModules = getWorkspacePackagesFromGraph(graph);
  const snapshot: ProjectSnapshot = { specifiers: {} };
  const importers: Record<string, string> = {};
  [
    'dependencies',
    'optionalDependencies',
    'devDependencies',
    'peerDependencies',
  ].forEach((depType) => {
    if (packageJson[depType]) {
      Object.keys(packageJson[depType]).forEach((packageName) => {
        let version = packageJson[depType][packageName];
        const manager = getCatalogManager(workspaceRoot);
        if (manager?.isCatalogReference(version)) {
          version = manager.resolveCatalogReference(
            workspaceRoot,
            packageName,
            version
          );
          if (!version) {
            throw new Error(
              `Could not resolve catalog reference for package ${packageName}@${version}.`
            );
          }
        }

        if (workspaceModules.has(packageName)) {
          for (const [importerPath, importerSnapshot] of Object.entries(
            rootImporters
          )) {
            const workspaceDep =
              importerSnapshot.dependencies &&
              importerSnapshot.dependencies[packageName];
            if (workspaceDep) {
              const workspaceDepImporterPath = workspaceDep.replace(
                'link:',
                ''
              );
              const importerKeyForPackage = join(
                importerPath,
                workspaceDepImporterPath
              );
              importers[packageName] = importerKeyForPackage;
              snapshot.specifiers[
                packageName
              ] = `file:./workspace_modules/${packageName}`;
              snapshot.dependencies = snapshot.dependencies || {};
              snapshot.dependencies[
                packageName
              ] = `link:./workspace_modules/${packageName}`;
              break;
            }
          }
        } else {
          const node =
            graph.externalNodes[`npm:${packageName}@${version}`] ||
            (graph.externalNodes[`npm:${packageName}`] &&
            graph.externalNodes[`npm:${packageName}`].data.version === version
              ? graph.externalNodes[`npm:${packageName}`]
              : findNodeMatchingVersion(graph, packageName, version));
          if (!node) {
            throw new Error(
              `Could not find external node for package ${packageName}@${version}.`
            );
          }
          snapshot.specifiers[packageName] = version;
          // peer dependencies are mapped to dependencies
          let section =
            depType === 'peerDependencies' ? 'dependencies' : depType;
          snapshot[section] = snapshot[section] || {};
          snapshot[section][packageName] = findOriginalKeys(
            packages,
            node,
            lockfileVersion
          )[0][0];
        }
      });
    }
  });

  Object.keys(snapshot).forEach((key) => {
    snapshot[key] = sortObjectByKeys(snapshot[key]);
  });

  return { snapshot, importers };
}

function findVersion(
  key: string,
  packageName: string,
  isV5: boolean,
  alias?: boolean
): string {
  if (isV5 && key.startsWith(`${packageName}/`)) {
    return getVersion(key, packageName);
  }
  // this matches v6 syntax and tarball packages
  if (key.startsWith(`${packageName}@`)) {
    return getVersion(key, packageName);
  }
  if (alias) {
    const aliasName = isV5
      ? key.slice(0, key.lastIndexOf('/'))
      : key.slice(0, key.indexOf('@', 2)); // we use 2 to ensure we don't catch the first @
    const version = getVersion(key, aliasName);
    return `npm:${aliasName}@${version}`;
  }
  // for tarball package the entire key is the version spec
  return key;
}

function getVersion(key: string, packageName: string): string {
  return key.slice(packageName.length + 1);
}

function extractNameFromKey(key: string, isV5: boolean): string {
  // if package name contains org e.g. "@babel/runtime@7.12.5"
  if (key.startsWith('@')) {
    if (isV5) {
      const startFrom = key.indexOf('/');
      return key.slice(0, key.indexOf('/', startFrom + 1));
    } else {
      // find the position of the '@'
      return key.slice(0, key.indexOf('@', 1));
    }
  }
  if (isV5) {
    // if package has just a name e.g. "react/7.12.5..."
    return key.slice(0, key.indexOf('/', 1));
  } else {
    // if package has just a name e.g. "react@7.12.5..."
    return key.slice(0, key.indexOf('@', 1));
  }
}
