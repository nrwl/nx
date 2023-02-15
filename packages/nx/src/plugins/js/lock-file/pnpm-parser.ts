import type {
  PackageSnapshot,
  Lockfile,
  ProjectSnapshot,
  PackageSnapshots,
} from '@pnpm/lockfile-types';
import {
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
import { defaultHashing } from '../../../hasher/hashing-impl';

export function parsePnpmLockfile(
  lockFileContent: string,
  builder: ProjectGraphBuilder
): void {
  const data = parseAndNormalizePnpmLockfile(lockFileContent);

  // we use key => node map to avoid duplicate work when parsing keys
  const keyMap = new Map<string, ProjectGraphExternalNode>();
  addNodes(data, builder, keyMap);
  addDependencies(data, builder, keyMap);
}

function addNodes(
  data: Lockfile,
  builder: ProjectGraphBuilder,
  keyMap: Map<string, ProjectGraphExternalNode>
) {
  const nodes: Map<string, Map<string, ProjectGraphExternalNode>> = new Map();

  Object.entries(data.packages).forEach(([key, snapshot]) => {
    const packageName = findPackageName(key, snapshot, data);
    const version = findVersion(key, packageName).split('_')[0];

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
          defaultHashing.hashArray(
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

  const hoistedDeps = loadPnpmHoistedDepsDefinition();
  for (const [packageName, versionMap] of nodes.entries()) {
    let hoistedNode: ProjectGraphExternalNode;
    if (versionMap.size === 1) {
      hoistedNode = versionMap.values().next().value;
    } else {
      const hoistedVersion = getHoistedVersion(hoistedDeps, packageName);
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
  packageName: string
): string {
  let version = getHoistedPackageVersion(packageName);

  if (!version) {
    const key = Object.keys(hoistedDependencies).find((k) =>
      k.startsWith(`/${packageName}/`)
    );
    if (key) {
      version = key.slice(key.lastIndexOf('/') + 1).split('_')[0];
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
  keyMap: Map<string, ProjectGraphExternalNode>
) {
  Object.entries(data.packages).forEach(([key, snapshot]) => {
    const node = keyMap.get(key);
    [snapshot.dependencies, snapshot.optionalDependencies].forEach(
      (section) => {
        if (section) {
          Object.entries(section).forEach(([name, versionRange]) => {
            const version = findVersion(versionRange, name).split('_')[0];
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

export function stringifyPnpmLockfile(
  graph: ProjectGraph,
  rootLockFileContent: string,
  packageJson: NormalizedPackageJson
): string {
  const data = parseAndNormalizePnpmLockfile(rootLockFileContent);

  const output: Lockfile = {
    lockfileVersion: data.lockfileVersion,
    importers: {
      '.': mapRootSnapshot(packageJson, data.packages, graph.externalNodes),
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
      matchedKeys.push([returnFullKey ? key : key.split('/').pop(), snapshot]);
    }
    // tarball package
    if (key === version) {
      matchedKeys.push([version, snapshot]);
    }
    // alias package
    if (
      version.startsWith('npm:') &&
      key.startsWith(
        `/${version.slice(4, version.lastIndexOf('@'))}/${version.slice(
          version.lastIndexOf('@') + 1
        )}`
      )
    ) {
      matchedKeys.push([key, snapshot]);
    }
  }
  return matchedKeys;
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
    return key.slice(key.lastIndexOf('/') + 1);
  }
  // for alias packages prepend with "npm:"
  if (key.startsWith('/')) {
    const aliasName = key.slice(1, key.lastIndexOf('/'));
    const version = key.slice(key.lastIndexOf('/') + 1);
    return `npm:${aliasName}@${version}`;
  }
  // for tarball package the entire key is the version spec
  return key;
}

function findPackageName(
  key: string,
  value: PackageSnapshot,
  data: Lockfile
): string {
  const matchPropValue = (record: Record<string, string>): string => {
    if (!record) {
      return undefined;
    }
    const index = Object.values(record).findIndex((version) => version === key);
    if (index > -1) {
      return Object.keys(record)[index];
    }
  };

  const matchedDependencyName = (
    snapshot: Partial<PackageSnapshot>
  ): string => {
    return (
      matchPropValue(snapshot.dependencies) ||
      matchPropValue(snapshot.optionalDependencies) ||
      matchPropValue(snapshot.peerDependencies)
    );
  };

  // snapshot already has a name
  if (value.name) {
    return value.name;
  }
  // it'a a root dependency
  const rootDependencyName =
    matchedDependencyName(data.importers['.']) ||
    // only root importers have devDependencies
    matchPropValue(data.importers['.'].devDependencies);
  if (rootDependencyName) {
    return rootDependencyName;
  }
  // find a snapshot that has a dependency that points to this snapshot
  const snapshots = Object.values(data.packages);
  for (let i = 0; i < snapshots.length; i++) {
    const snapshot = snapshots[i];
    const dependencyName = matchedDependencyName(snapshot);
    if (dependencyName) {
      return dependencyName;
    }
  }
  // otherwise, it's a standard package
  return key.startsWith('/') ? key.slice(1, key.lastIndexOf('/')) : key;
}
