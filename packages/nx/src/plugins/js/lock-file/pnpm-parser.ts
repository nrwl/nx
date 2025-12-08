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

/**
 * Index type for O(1) package lookup by name instead of O(n) iteration.
 * Maps packageName -> array of [key, snapshot] entries for that package.
 */
type PackageIndex = Map<string, Array<[string, PackageSnapshot]>>;

/**
 * Pre-builds an index of packages by package name for O(1) lookup.
 * This transforms findOriginalKeys from O(n*m) to O(n+m) where:
 * - n = number of external nodes
 * - m = number of packages
 *
 * Example impact: 500 nodes × 1000 packages = 500,000 iterations → 1,500 operations
 */
function buildPackageIndex(
  packages: PackageSnapshots,
  lockfileVersion: number
): PackageIndex {
  const isV5 = lockfileVersion < 6;
  const index: PackageIndex = new Map();

  for (const [key, snapshot] of Object.entries(packages)) {
    let packageName: string;

    // Tarball packages have a 'name' field in the snapshot and don't follow
    // the standard key format (e.g., github.com/user/repo/commit)
    if (snapshot.resolution?.['tarball'] && snapshot['name']) {
      packageName = snapshot['name'] as string;
    } else {
      // Handle keys that may have leading / (v5 format in some cases)
      const normalizedKey = key.startsWith('/') ? key.slice(1) : key;
      packageName = extractNameFromKey(normalizedKey, isV5);
    }

    if (!index.has(packageName)) {
      index.set(packageName, []);
    }
    index.get(packageName)!.push([key, snapshot]);
  }

  return index;
}

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

function matchPropValue(
  record: Record<string, string>,
  key: string,
  originalPackageName: string
): string | undefined {
  if (!record) {
    return undefined;
  }
  const index = Object.values(record).findIndex((version) => version === key);
  if (index > -1) {
    return Object.keys(record)[index];
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
    matchPropValue(importer.dependencies, key, originalPackageName) ||
    matchPropValue(importer.optionalDependencies, key, originalPackageName) ||
    matchPropValue(importer.peerDependencies, key, originalPackageName)
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
        originalPackageName
      ) ||
      matchPropValue(
        data.importers['.'].devDependencies,
        `/${key}`,
        originalPackageName
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
  const results: Record<string, ProjectGraphExternalNode> = {};

  for (const [packageName, versionMap] of nodes.entries()) {
    let hoistedNode: ProjectGraphExternalNode;
    if (versionMap.size === 1) {
      hoistedNode = versionMap.values().next().value;
    } else {
      const hoistedVersion = getHoistedVersion(hoistedDeps, packageName, isV5);
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
  hoistedDependencies: Record<string, any>,
  packageName: string,
  isV5: boolean
): string {
  let version = getHoistedPackageVersion(packageName);

  if (!version) {
    const key = Object.keys(hoistedDependencies).find((k) =>
      k.startsWith(`/${packageName}/`)
    );
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
  Object.entries(data.packages).forEach(([key, snapshot]) => {
    const nodes = keyMap.get(key);
    nodes.forEach((node) => {
      [snapshot.dependencies, snapshot.optionalDependencies].forEach(
        (section) => {
          if (section) {
            Object.entries(section).forEach(([name, versionRange]) => {
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

  // Pre-build package index once for O(1) lookups instead of O(n) per node
  // This transforms O(n*m) to O(n+m) for findOriginalKeys calls
  const packageIndex = buildPackageIndex(packages, +lockfileVersion);

  const { snapshot: rootSnapshot, importers: requiredImporters } =
    mapRootSnapshot(
      packageJson,
      importers,
      packages,
      graph,
      +lockfileVersion,
      workspaceRoot,
      packageIndex
    );
  const snapshots = mapSnapshots(
    data.packages,
    graph.externalNodes,
    +lockfileVersion,
    packageIndex
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
  lockfileVersion: number,
  packageIndex?: PackageIndex
): PackageSnapshots {
  const result: PackageSnapshots = {};
  Object.values(nodes).forEach((node) => {
    const matchedKeys = findOriginalKeys(packages, node, lockfileVersion, {
      returnFullKey: true,
      packageIndex,
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

/**
 * Helper to check if a key matches a package name (for fallback path without index)
 */
function keyMatchesPackage(
  key: string,
  packageName: string,
  lockfileVersion: number
): boolean {
  if (lockfileVersion < 6) {
    return key.startsWith(`${packageName}/`);
  }
  return key.startsWith(`${packageName}@`);
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
  {
    returnFullKey,
    packageIndex,
  }: { returnFullKey?: boolean; packageIndex?: PackageIndex } = {}
): Array<[string, PackageSnapshot]> {
  const matchedKeys = [];

  // For alias packages (npm:realPkg@version), we need to look up by the real package name
  let lookupName = packageName;
  const PREFIX = 'npm:';
  if (version.startsWith(PREFIX)) {
    const indexOfVersionSeparator = version.indexOf('@', PREFIX.length + 1);
    if (indexOfVersionSeparator > PREFIX.length) {
      lookupName = version.slice(PREFIX.length, indexOfVersionSeparator);
    }
  }

  // Use pre-built index for O(1) lookup if available, otherwise fall back to O(n) iteration
  const entries = packageIndex
    ? packageIndex.get(lookupName) || []
    : Object.entries(packages).map(
        ([key, snapshot]) => [key, snapshot] as [string, PackageSnapshot]
      );

  for (const [key, snapshot] of entries) {
    // Skip entries that don't match the package name (only needed for fallback path)
    if (
      !packageIndex &&
      !keyMatchesPackage(key, packageName, lockfileVersion)
    ) {
      continue;
    }

    // tarball package - can match by key prefix OR by snapshot name field
    if (snapshot.resolution?.['tarball']) {
      if (key.startsWith(`${packageName}@${version}`)) {
        matchedKeys.push([getVersion(key, packageName), snapshot]);
        continue;
      }
      // GitHub tarballs have keys like 'github.com/user/repo/commit' with a 'name' field
      if (snapshot['name'] === packageName) {
        // Return the version (which is the tarball URL) as the key
        matchedKeys.push([version, snapshot]);
        continue;
      }
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
  workspaceRoot: string,
  packageIndex?: PackageIndex
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
          const foundKeys = findOriginalKeys(packages, node, lockfileVersion, {
            packageIndex,
          });
          if (foundKeys.length > 0) {
            snapshot[section][packageName] = foundKeys[0][0];
          }
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
