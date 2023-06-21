import type {
  PackageSnapshot,
  Lockfile,
  ProjectSnapshot,
  PackageSnapshots,
} from '@pnpm/lockfile-types';
import {
  isV6Lockfile,
  loadPnpmHoistedDepsDefinition,
  parseAndNormalizePnpmLockfile,
  stringifyToPnpmYaml,
} from './utils/pnpm-normalizer';
import { getHoistedPackageVersion } from './utils/package-json';
import { NormalizedPackageJson } from './utils/package-json';
import { sortObjectByKeys } from '../../../utils/object-sort';
import { ProjectGraphBuilder } from '../../../project-graph/project-graph-builder';
import {
  ProjectGraph,
  ProjectGraphExternalNode,
} from '../../../config/project-graph';
import { hashArray } from '../../../hasher/file-hasher';

export function parsePnpmLockfile(
  lockFileContent: string,
  builder: ProjectGraphBuilder
): void {
  const data = parseAndNormalizePnpmLockfile(lockFileContent);
  const isV6 = isV6Lockfile(data);

  // we use key => node map to avoid duplicate work when parsing keys
  const keyMap = new Map<string, ProjectGraphExternalNode>();

  addNodes(data, builder, keyMap, isV6);
  addDependencies(data, builder, keyMap, isV6);
}

function addNodes(
  data: Lockfile,
  builder: ProjectGraphBuilder,
  keyMap: Map<string, ProjectGraphExternalNode>,
  isV6: boolean
) {
  const nodes: Map<string, Map<string, ProjectGraphExternalNode>> = new Map();

  Object.entries(data.packages).forEach(([key, snapshot]) => {
    findPackageNames(key, snapshot, data).forEach((packageName) => {
      const rawVersion = findVersion(key, packageName);
      const version = parseBaseVersion(rawVersion, isV6);

      // we don't need to keep duplicates, we can just track the keys
      const existingNode = nodes.get(packageName)?.get(version);
      if (existingNode) {
        keyMap.set(key, existingNode);
        return;
      }

      const node: ProjectGraphExternalNode = {
        type: 'npm',
        name: version ? `npm:${packageName}@${version}` : `npm:${packageName}`,
        data: {
          version,
          packageName,
          hash:
            snapshot.resolution?.['integrity'] ||
            hashArray(
              snapshot.resolution?.['tarball']
                ? [snapshot.resolution['tarball']]
                : [packageName, version]
            ),
        },
      };

      keyMap.set(key, node);
      if (!nodes.has(packageName)) {
        nodes.set(packageName, new Map([[version, node]]));
      } else {
        nodes.get(packageName).set(version, node);
      }
    });
  });

  const hoistedDeps = loadPnpmHoistedDepsDefinition();
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
      builder.addExternalNode(node);
    });
  }
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

function addDependencies(
  data: Lockfile,
  builder: ProjectGraphBuilder,
  keyMap: Map<string, ProjectGraphExternalNode>,
  isV6: boolean
) {
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
              builder.graph.externalNodes[`npm:${name}@${version}`] ||
              builder.graph.externalNodes[`npm:${name}`];
            if (target) {
              builder.addStaticDependency(node.name, target.name);
            }
          });
        }
      }
    );
  });
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

function findPackageNames(
  key: string,
  snapshot: PackageSnapshot,
  data: Lockfile
): string[] {
  const packageNames = new Set<string>();
  const originalPackageName = extractNameFromKey(key);

  const matchPropValue = (record: Record<string, string>): string => {
    if (!record) {
      return undefined;
    }
    const index = Object.values(record).findIndex((version) => version === key);
    if (index > -1) {
      return Object.keys(record)[index];
    }
    // check if non aliased name is found
    if (
      record[originalPackageName] &&
      key.startsWith(`/${originalPackageName}/${record[originalPackageName]}`)
    ) {
      return originalPackageName;
    }
  };

  const matchedDependencyName = (
    importer: Partial<PackageSnapshot>
  ): string => {
    return (
      matchPropValue(importer.dependencies) ||
      matchPropValue(importer.optionalDependencies) ||
      matchPropValue(importer.peerDependencies)
    );
  };

  // snapshot already has a name
  if (snapshot.name) {
    packageNames.add(snapshot.name);
  }
  // it'a a root dependency
  const rootDependencyName =
    matchedDependencyName(data.importers['.']) ||
    // only root importers have devDependencies
    matchPropValue(data.importers['.'].devDependencies);
  if (rootDependencyName) {
    packageNames.add(rootDependencyName);
  }
  // find a snapshot that has a dependency that points to this snapshot
  const snapshots = Object.values(data.packages);
  for (let i = 0; i < snapshots.length; i++) {
    const dependencyName = matchedDependencyName(snapshots[i]);
    if (dependencyName) {
      packageNames.add(dependencyName);
    }
  }
  if (packageNames.size === 0) {
    packageNames.add(originalPackageName);
  }
  return Array.from(packageNames);
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
