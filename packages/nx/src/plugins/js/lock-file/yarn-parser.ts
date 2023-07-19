import { getHoistedPackageVersion } from './utils/package-json';
import { ProjectGraphBuilder } from '../../../project-graph/project-graph-builder';
import { satisfies, Range } from 'semver';
import { NormalizedPackageJson } from './utils/package-json';
import {
  ProjectGraph,
  ProjectGraphExternalNode,
} from '../../../config/project-graph';
import { hashArray } from '../../../hasher/file-hasher';
import { sortObjectByKeys } from '../../../utils/object-sort';

/**
 * Yarn
 * - Classic has resolved and integrity
 * - Berry has resolution, checksum, languageName and linkType
 */
type YarnLockFile = {
  __metadata?: {};
} & Record<string, YarnDependency>;

type YarnDependency = {
  version: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;

  // classic specific
  resolved?: string;
  integrity?: string;

  // berry specific
  resolution?: string;
  checksum?: string;
  languageName?: string;
  linkType?: 'soft' | 'hard';
};

export function parseYarnLockfile(
  lockFileContent: string,
  builder: ProjectGraphBuilder
) {
  const { parseSyml } = require('@yarnpkg/parsers');
  const data = parseSyml(lockFileContent);

  // we use key => node map to avoid duplicate work when parsing keys
  const keyMap = new Map<string, ProjectGraphExternalNode>();
  addNodes(data, builder, keyMap);
  addDependencies(data, builder, keyMap);
}

function getPackageNames(keys: string): string[] {
  const packageNames = new Set<string>();
  keys.split(', ').forEach((key) => {
    const packageName = key.slice(0, key.indexOf('@', 1));
    packageNames.add(packageName);
  });
  return Array.from(packageNames);
}

function addNodes(
  { __metadata, ...dependencies }: YarnLockFile,
  builder: ProjectGraphBuilder,
  keyMap: Map<string, ProjectGraphExternalNode>
) {
  const isBerry = !!__metadata;
  const nodes: Map<string, Map<string, ProjectGraphExternalNode>> = new Map();

  Object.entries(dependencies).forEach(([keys, snapshot]) => {
    // ignore workspace projects & patches
    if (snapshot.linkType === 'soft' || keys.includes('@patch:')) {
      return;
    }
    const packageNames = getPackageNames(keys);
    packageNames.forEach((packageName) => {
      const version = findVersion(
        packageName,
        keys.split(', ')[0],
        snapshot,
        isBerry
      );

      keys.split(', ').forEach((key) => {
        // we don't need to keep duplicates, we can just track the keys
        const existingNode = nodes.get(packageName)?.get(version);
        if (existingNode) {
          keyMap.set(key, existingNode);
          return;
        }

        const node: ProjectGraphExternalNode = {
          type: 'npm',
          name: version
            ? `npm:${packageName}@${version}`
            : `npm:${packageName}`,
          data: {
            version,
            packageName,
            hash:
              snapshot.integrity ||
              snapshot.checksum ||
              hashArray([packageName, version]),
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
  });

  for (const [packageName, versionMap] of nodes.entries()) {
    let hoistedNode: ProjectGraphExternalNode;
    if (versionMap.size === 1) {
      hoistedNode = versionMap.values().next().value;
    } else {
      const hoistedVersion = getHoistedVersion(packageName);
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

function findVersion(
  packageName: string,
  key: string,
  snapshot: YarnDependency,
  isBerry: boolean
): string {
  const versionRange = key.slice(packageName.length + 1);
  // check for alias packages
  const isAlias = isBerry
    ? snapshot.resolution && !snapshot.resolution.startsWith(`${packageName}@`)
    : versionRange.startsWith('npm:');
  if (isAlias) {
    return versionRange;
  }
  // check for berry tarball packages
  if (
    isBerry &&
    snapshot.resolution &&
    // different registry would yield suffix following '::' which we don't need
    snapshot.resolution.split('::')[0] !==
      `${packageName}@npm:${snapshot.version}`
  ) {
    return snapshot.resolution.slice(packageName.length + 1);
  }

  if (!isBerry && snapshot.resolved && !isValidVersionRange(versionRange)) {
    return snapshot.resolved;
  }
  // otherwise it's a standard version
  return snapshot.version;
}

// check if value can be parsed as a semver range
function isValidVersionRange(versionRange: string): boolean {
  try {
    new Range(versionRange);
    return true;
  } catch {
    return false;
  }
}

function getHoistedVersion(packageName: string): string {
  const version = getHoistedPackageVersion(packageName);
  if (version) {
    return version;
  }
}

function addDependencies(
  { __metadata, ...dependencies }: YarnLockFile,
  builder: ProjectGraphBuilder,
  keyMap: Map<string, ProjectGraphExternalNode>
) {
  Object.keys(dependencies).forEach((keys) => {
    const snapshot = dependencies[keys];
    keys.split(', ').forEach((key) => {
      if (keyMap.has(key)) {
        const node = keyMap.get(key);
        [snapshot.dependencies, snapshot.optionalDependencies].forEach(
          (section) => {
            if (section) {
              Object.entries(section).forEach(([name, versionRange]) => {
                const target =
                  keyMap.get(`${name}@npm:${versionRange}`) ||
                  keyMap.get(`${name}@${versionRange}`);
                if (target) {
                  builder.addStaticDependency(node.name, target.name);
                }
              });
            }
          }
        );
      }
    });
  });
}

export function stringifyYarnLockfile(
  graph: ProjectGraph,
  rootLockFileContent: string,
  packageJson: NormalizedPackageJson
): string {
  const { parseSyml, stringifySyml } = require('@yarnpkg/parsers');
  const { __metadata, ...dependencies } = parseSyml(rootLockFileContent);
  const isBerry = !!__metadata;

  const snapshots = mapSnapshots(
    dependencies,
    graph.externalNodes,
    packageJson,
    isBerry
  );

  if (isBerry) {
    // add root workspace package
    const workspacePackage = generateRootWorkspacePackage(packageJson);
    snapshots[workspacePackage.resolution] = workspacePackage;

    return (
      BERRY_LOCK_FILE_DISCLAIMER +
      stringifySyml({
        __metadata,
        ...sortObjectByKeys(snapshots),
      })
    );
  } else {
    const { stringify } = require('@yarnpkg/lockfile');
    return stringify(sortObjectByKeys(snapshots));
  }
}

function groupDependencies(
  dependencies: Record<string, YarnDependency>
): Record<string, YarnDependency> {
  let groupedDependencies: Record<string, YarnDependency>;
  const resolutionMap = new Map<string, YarnDependency>();
  const snapshotMap = new Map<YarnDependency, Set<string>>();
  Object.entries(dependencies).forEach(([key, snapshot]) => {
    const resolutionKey = `${snapshot.resolved}${snapshot.integrity}`;
    if (resolutionMap.has(resolutionKey)) {
      const existingSnapshot = resolutionMap.get(resolutionKey);
      snapshotMap.get(existingSnapshot).add(key);
    } else {
      resolutionMap.set(resolutionKey, snapshot);
      snapshotMap.set(snapshot, new Set([key]));
    }
  });
  groupedDependencies = {};
  snapshotMap.forEach((keys, snapshot) => {
    groupedDependencies[Array.from(keys).join(', ')] = snapshot;
  });
  return groupedDependencies;
}

function addPackageVersion(
  packageName: string,
  version: string,
  collection: Map<string, Set<string>>,
  isBerry?: boolean
) {
  if (!collection.has(packageName)) {
    collection.set(packageName, new Set());
  }
  collection.get(packageName).add(`${packageName}@${version}`);
  if (isBerry && !version.startsWith('npm:')) {
    collection.get(packageName).add(`${packageName}@npm:${version}`);
  }
}

function mapSnapshots(
  dependencies: Record<string, YarnDependency>,
  nodes: Record<string, ProjectGraphExternalNode>,
  packageJson: NormalizedPackageJson,
  isBerry: boolean
): Record<string, YarnDependency> {
  // map snapshot to set of keys (e.g. `eslint@^7.0.0, eslint@npm:^7.0.0`)
  const snapshotMap: Map<YarnDependency, Set<string>> = new Map();
  // track all existing dependencies's keys
  const existingKeys = new Map<string, Set<string>>();
  const combinedDependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...packageJson.optionalDependencies,
    ...packageJson.peerDependencies,
  };

  let groupedDependencies: Record<string, YarnDependency>;
  if (isBerry) {
    groupedDependencies = dependencies;
  } else {
    // yarn classic splits keys when parsing so we need to stich them back together
    groupedDependencies = groupDependencies(dependencies);
  }

  // collect snapshots and their matching keys
  Object.values(nodes).forEach((node) => {
    const foundOriginalKeys = findOriginalKeys(groupedDependencies, node);
    if (!foundOriginalKeys) {
      throw new Error(
        `Original key(s) not found for "${node.data.packageName}@${node.data.version}" while pruning yarn.lock.`
      );
    }
    const [matchedKeys, snapshot] = foundOriginalKeys;
    snapshotMap.set(snapshot, new Set(matchedKeys));

    // separately save keys that still exist
    [snapshot.dependencies, snapshot.optionalDependencies].forEach(
      (section) => {
        Object.entries(section || {}).forEach(([name, versionSpec]) =>
          addPackageVersion(name, versionSpec, existingKeys, isBerry)
        );
      }
    );

    // add package.json requested version to keys
    const requestedVersion = getPackageJsonVersion(combinedDependencies, node);
    if (requestedVersion) {
      addPackageVersion(
        node.data.packageName,
        requestedVersion,
        existingKeys,
        isBerry
      );
      const requestedKey = isBerry
        ? reverseMapBerryKey(node, requestedVersion, snapshot)
        : `${node.data.packageName}@${requestedVersion}`;
      if (!snapshotMap.get(snapshot).has(requestedKey)) {
        snapshotMap.get(snapshot).add(requestedKey);
      }
    }

    if (isBerry) {
      // look for patched versions
      const patch = findPatchedKeys(groupedDependencies, node);
      if (patch) {
        const [matchedKeys, snapshot] = patch;
        snapshotMap.set(snapshot, new Set(matchedKeys));
      }
    }
  });

  // remove keys that match version ranges that have been pruned away
  snapshotMap.forEach((keysSet) => {
    for (const key of keysSet.values()) {
      const packageName = key.slice(0, key.indexOf('@', 1));
      let normalizedKey = key;
      if (isBerry && key.includes('@patch:') && key.includes('#')) {
        normalizedKey = key
          .slice(0, key.indexOf('#'))
          .replace(`@patch:${packageName}@`, '@npm:');
      }
      if (
        !existingKeys.get(packageName) ||
        !existingKeys.get(packageName).has(normalizedKey)
      ) {
        keysSet.delete(key);
      }
    }
  });

  // join mapped snapshots to lock json file
  const result: Record<string, YarnDependency> = {};
  snapshotMap.forEach((keysSet, snapshot) => {
    if (isBerry) {
      result[Array.from(keysSet).sort().join(', ')] = snapshot;
    } else {
      for (const key of keysSet.values()) {
        result[key] = snapshot;
      }
    }
  });

  return result;
}

function reverseMapBerryKey(
  node: ProjectGraphExternalNode,
  version: string,
  snapshot: YarnDependency
): string {
  // alias packages already have version
  if (version.startsWith('npm:')) {
    `${node.data.packageName}@${version}`;
  }
  // check for berry tarball packages
  if (
    snapshot.resolution &&
    snapshot.resolution === `${node.data.packageName}@${version}`
  ) {
    return snapshot.resolution;
  }

  return `${node.data.packageName}@npm:${version}`;
}

function getPackageJsonVersion(
  combinedDependencies: Record<string, string>,
  node: ProjectGraphExternalNode
): string {
  const { packageName, version } = node.data;

  if (combinedDependencies[packageName]) {
    if (
      combinedDependencies[packageName] === version ||
      satisfies(version, combinedDependencies[packageName])
    ) {
      return combinedDependencies[packageName];
    }
  }
}

function findOriginalKeys(
  dependencies: Record<string, YarnDependency>,
  node: ProjectGraphExternalNode
): [string[], YarnDependency] {
  for (const keyExpr of Object.keys(dependencies)) {
    const snapshot = dependencies[keyExpr];
    const keys = keyExpr.split(', ');
    if (!keys.some((k) => k.startsWith(`${node.data.packageName}@`))) {
      continue;
    }
    // standard package
    if (snapshot.version === node.data.version) {
      return [keys, snapshot];
    }
    // berry alias package
    if (
      snapshot.resolution &&
      `npm:${snapshot.resolution}` === node.data.version
    ) {
      return [keys, snapshot];
    }
    // classic alias
    if (
      node.data.version.startsWith('npm:') &&
      keys.some((k) => k === `${node.data.packageName}@${node.data.version}`)
    ) {
      return [keys, snapshot];
    }
    // tarball package
    if (
      snapshot.resolved === node.data.version ||
      snapshot.resolution === `${node.data.packageName}@${node.data.version}`
    ) {
      return [keys, snapshot];
    }
  }
}

function findPatchedKeys(
  dependencies: Record<string, YarnDependency>,
  node: ProjectGraphExternalNode
): [string[], YarnDependency] | void {
  for (const keyExpr of Object.keys(dependencies)) {
    const snapshot = dependencies[keyExpr];
    const keys = keyExpr.split(', ');
    if (!keys[0].startsWith(`${node.data.packageName}@patch:`)) {
      continue;
    }
    if (snapshot.version === node.data.version) {
      return [keys, snapshot];
    }
  }
}

const BERRY_LOCK_FILE_DISCLAIMER = `# This file is generated by running "yarn install" inside your project.\n# Manual changes might be lost - proceed with caution!\n\n`;

function generateRootWorkspacePackage(
  packageJson: NormalizedPackageJson
): YarnDependency {
  return {
    version: '0.0.0-use.local',
    resolution: `${packageJson.name}@workspace:.`,
    ...(packageJson.dependencies && { dependencies: packageJson.dependencies }),
    ...(packageJson.peerDependencies && {
      peerDependencies: packageJson.peerDependencies,
    }),
    ...(packageJson.devDependencies && {
      devDependencies: packageJson.devDependencies,
    }),
    ...(packageJson.optionalDependencies && {
      optionalDependencies: packageJson.optionalDependencies,
    }),
    languageName: 'unknown',
    linkType: 'soft',
  };
}
