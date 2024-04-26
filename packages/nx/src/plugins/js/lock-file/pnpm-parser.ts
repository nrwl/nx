import type {
  Lockfile,
  PackageSnapshot,
  PackageSnapshots,
  ProjectSnapshot,
} from '@pnpm/lockfile-types';
import {
  isV6Lockfile,
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

// we use key => node map to avoid duplicate work when parsing keys
let keyMap = new Map<string, ProjectGraphExternalNode>();
let currentLockFileHash: string;

let parsedLockFile: Lockfile;
function parsePnpmLockFile(lockFileContent: string, lockFileHash: string) {
  if (lockFileHash === currentLockFileHash) {
    return parsedLockFile;
  }

  keyMap.clear();
  const results = parseAndNormalizePnpmLockfile(lockFileContent);
  parsedLockFile = results;
  currentLockFileHash = lockFileHash;
  return results;
}

export function getPnpmLockfileNodes(
  lockFileContent: string,
  lockFileHash: string
) {
  const data = parsePnpmLockFile(lockFileContent, lockFileHash);
  const isV6 = isV6Lockfile(data);

  return getNodes(data, keyMap, isV6);
}

export function getPnpmLockfileDependencies(
  lockFileContent: string,
  lockFileHash: string,
  ctx: CreateDependenciesContext
) {
  const data = parsePnpmLockFile(lockFileContent, lockFileHash);
  const isV6 = isV6Lockfile(data);

  return getDependencies(data, keyMap, isV6, ctx);
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

function isLockFileKey(depVersion: string) {
  return depVersion.startsWith('/');
}

function getNodes(
  data: Lockfile,
  keyMap: Map<string, ProjectGraphExternalNode>,
  isV6: boolean
): Record<string, ProjectGraphExternalNode> {
  const nodes: Map<string, Map<string, ProjectGraphExternalNode>> = new Map();

  const maybeAliasedPackageVersions = new Map<string, string>(); // <version, alias>

  const packageNames = new Set<{
    key: string;
    packageName: string;
    hash?: string;
  }>();
  for (const [key, snapshot] of Object.entries(data.packages)) {
    const originalPackageName = extractNameFromKey(key);
    if (!originalPackageName) {
      continue;
    }
    // snapshot already has a name
    if (snapshot.name) {
      packageNames.add({
        key,
        packageName: snapshot.name,
        hash: createHashFromSnapshot(snapshot),
      });
    }
    const rootDependencyName =
      matchedDependencyName(data.importers['.'], key, originalPackageName) ||
      // only root importers have devDependencies
      matchPropValue(
        data.importers['.'].devDependencies,
        key,
        originalPackageName
      );
    if (rootDependencyName) {
      packageNames.add({
        key,
        packageName: rootDependencyName,
        hash: createHashFromSnapshot(snapshot),
      });
    }

    if (!snapshot.name && !rootDependencyName) {
      packageNames.add({
        key,
        packageName: originalPackageName,
        hash: createHashFromSnapshot(snapshot),
      });
    }

    if (snapshot.peerDependencies) {
      for (const [depName, depVersion] of Object.entries(
        snapshot.peerDependencies
      )) {
        if (isLockFileKey(depVersion)) {
          maybeAliasedPackageVersions.set(depVersion, depName);
        }
      }
    }
    if (snapshot.optionalDependencies) {
      for (const [depName, depVersion] of Object.entries(
        snapshot.optionalDependencies
      )) {
        if (isLockFileKey(depVersion)) {
          maybeAliasedPackageVersions.set(depVersion, depName);
        }
      }
    }
    if (snapshot.dependencies) {
      for (const [depName, depVersion] of Object.entries(
        snapshot.dependencies
      )) {
        if (isLockFileKey(depVersion)) {
          maybeAliasedPackageVersions.set(depVersion, depName);
        }
      }
    }

    const aliasedDep = maybeAliasedPackageVersions.get(key);
    if (aliasedDep) {
      packageNames.add({
        key,
        packageName: aliasedDep,
        hash: createHashFromSnapshot(snapshot),
      });
    }
  }

  for (const { key, packageName, hash } of packageNames) {
    const rawVersion = findVersion(key, packageName);
    if (!rawVersion) {
      continue;
    }
    const version = parseBaseVersion(rawVersion, isV6);
    if (!version) {
      continue;
    }

    if (!nodes.has(packageName)) {
      nodes.set(packageName, new Map());
    }

    if (!nodes.get(packageName).has(version)) {
      const node: ProjectGraphExternalNode = {
        type: 'npm',
        name: version ? `npm:${packageName}@${version}` : `npm:${packageName}`,
        data: {
          version,
          packageName,
          hash: hash ?? hashArray([packageName, version]),
        },
      };
      nodes.get(packageName).set(version, node);
      keyMap.set(key, node);
    } else {
      keyMap.set(key, nodes.get(packageName).get(version));
    }
  }

  const hoistedDeps = loadPnpmHoistedDepsDefinition();
  const results: Record<string, ProjectGraphExternalNode> = {};

  for (const [packageName, versionMap] of nodes.entries()) {
    let hoistedNode: ProjectGraphExternalNode;
    if (versionMap.size === 1) {
      hoistedNode = versionMap.values().next().value;
    } else {
      const hoistedVersion = getHoistedVersion(hoistedDeps, packageName, isV6);
      hoistedNode = versionMap.get(hoistedVersion);
    }
    if (hoistedNode) {
      hoistedNode.name = `npm:${packageName}`;
    }

    versionMap.forEach((node) => {
      results[node.name] = node;
    });
  }
  return results;
}

function getHoistedVersion(
  hoistedDependencies: Record<string, any>,
  packageName: string,
  isV6: boolean
): string {
  let version = getHoistedPackageVersion(packageName);

  if (!version) {
    const key = Object.keys(hoistedDependencies).find((k) =>
      k.startsWith(`/${packageName}/`)
    );
    if (key) {
      version = parseBaseVersion(getVersion(key, packageName), isV6);
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
  keyMap: Map<string, ProjectGraphExternalNode>,
  isV6: boolean,
  ctx: CreateDependenciesContext
): RawProjectGraphDependency[] {
  const results: RawProjectGraphDependency[] = [];
  Object.entries(data.packages).forEach(([key, snapshot]) => {
    const node = keyMap.get(key);
    [snapshot.dependencies, snapshot.optionalDependencies].forEach(
      (section) => {
        if (section) {
          Object.entries(section).forEach(([name, versionRange]) => {
            const version = parseBaseVersion(
              findVersion(versionRange, name),
              isV6
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

  return results;
}

function parseBaseVersion(rawVersion: string, isV6: boolean): string {
  return isV6 ? rawVersion.split('(')[0] : rawVersion.split('_')[0];
}

export function stringifyPnpmLockfile(
  graph: ProjectGraph,
  rootLockFileContent: string,
  packageJson: NormalizedPackageJson
): string {
  const data = parseAndNormalizePnpmLockfile(rootLockFileContent);
  const { lockfileVersion, packages } = data;

  const output: Lockfile = {
    lockfileVersion,
    importers: {
      '.': mapRootSnapshot(packageJson, packages, graph.externalNodes),
    },
    packages: sortObjectByKeys(
      mapSnapshots(data.packages, graph.externalNodes)
    ),
  };

  return stringifyToPnpmYaml(output);
}

function mapSnapshots(
  packages: PackageSnapshots,
  nodes: Record<string, ProjectGraphExternalNode>
): PackageSnapshots {
  const result: PackageSnapshots = {};
  Object.values(nodes).forEach((node) => {
    const matchedKeys = findOriginalKeys(packages, node, {
      returnFullKey: true,
    });
    // the package manager doesn't check for types of dependencies
    // so we can safely set all to prod
    matchedKeys.forEach(([key, snapshot]) => {
      snapshot.dev = false;
      result[key] = snapshot;
    });
  });
  return result;
}

function findOriginalKeys(
  packages: PackageSnapshots,
  { data: { packageName, version } }: ProjectGraphExternalNode,
  { returnFullKey }: { returnFullKey?: boolean } = {}
): Array<[string, PackageSnapshot]> {
  const matchedKeys = [];
  for (const key of Object.keys(packages)) {
    const snapshot = packages[key];
    // standard package
    if (key.startsWith(`/${packageName}/${version}`)) {
      matchedKeys.push([
        returnFullKey ? key : getVersion(key, packageName),
        snapshot,
      ]);
    }
    // tarball package
    if (key === version) {
      matchedKeys.push([version, snapshot]);
    }
    // alias package
    if (versionIsAlias(key, version)) {
      matchedKeys.push([key, snapshot]);
    }
  }
  return matchedKeys;
}

// check if version has a form of npm:packageName@version and
// key starts with /packageName/version
function versionIsAlias(key: string, versionExpr: string): boolean {
  const PREFIX = 'npm:';
  if (!versionExpr.startsWith(PREFIX)) return false;

  const indexOfVersionSeparator = versionExpr.indexOf('@', PREFIX.length + 1);
  const packageName = versionExpr.slice(PREFIX.length, indexOfVersionSeparator);
  const version = versionExpr.slice(indexOfVersionSeparator + 1);
  return key.startsWith(`/${packageName}/${version}`);
}

function mapRootSnapshot(
  packageJson: NormalizedPackageJson,
  packages: PackageSnapshots,
  nodes: Record<string, ProjectGraphExternalNode>
): ProjectSnapshot {
  const snapshot: ProjectSnapshot = { specifiers: {} };
  [
    'dependencies',
    'optionalDependencies',
    'devDependencies',
    'peerDependencies',
  ].forEach((depType) => {
    if (packageJson[depType]) {
      Object.keys(packageJson[depType]).forEach((packageName) => {
        const version = packageJson[depType][packageName];
        const node =
          nodes[`npm:${packageName}@${version}`] || nodes[`npm:${packageName}`];
        snapshot.specifiers[packageName] = version;
        // peer dependencies are mapped to dependencies
        let section = depType === 'peerDependencies' ? 'dependencies' : depType;
        snapshot[section] = snapshot[section] || {};
        snapshot[section][packageName] = findOriginalKeys(packages, node)[0][0];
      });
    }
  });

  Object.keys(snapshot).forEach((key) => {
    snapshot[key] = sortObjectByKeys(snapshot[key]);
  });

  return snapshot;
}

function findVersion(key: string, packageName: string): string {
  if (key.startsWith(`/${packageName}/`)) {
    return getVersion(key, packageName);
  }
  // for alias packages prepend with "npm:"
  if (key.startsWith('/')) {
    const aliasName = key.slice(1, key.lastIndexOf('/'));
    const version = getVersion(key, aliasName);
    return `npm:${aliasName}@${version}`;
  }

  // for tarball package the entire key is the version spec
  return key;
}

function getVersion(key: string, packageName: string): string {
  const KEY_NAME_SEPARATOR_LENGTH = 2; // leading and trailing slash

  return key.slice(packageName.length + KEY_NAME_SEPARATOR_LENGTH);
}

function extractNameFromKey(key: string): string {
  // if package name contains org e.g. "/@babel/runtime/7.12.5"
  // we want slice until the third slash
  if (key.startsWith('/@')) {
    // find the position of the '/' after org name
    const startFrom = key.indexOf('/', 1);
    return key.slice(1, key.indexOf('/', startFrom + 1));
  }
  if (key.startsWith('/')) {
    // if package has just a name e.g. "/react/7.12.5..."
    return key.slice(1, key.indexOf('/', 1));
  }
  return key;
}
