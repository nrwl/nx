import { parseSyml, stringifySyml } from '@yarnpkg/parsers';
import { stringify } from '@yarnpkg/lockfile';
import { YarnDependency } from './utils/types';
import { sortObjectByKeys } from '../utils/object-sort';
import { getRootVersion } from './utils/parsing-utils';
import {
  ProjectGraph,
  ProjectGraphExternalNode,
} from '../config/project-graph';
import { ProjectGraphBuilder } from '../project-graph/project-graph-builder';
import { satisfies } from 'semver';
import { NormalizedPackageJson } from './utils/pruning';
import { _ } from 'ajv';

export function parseYarnLockfile(lockFileContent: string): ProjectGraph {
  const { __metadata, ...dependencies } = parseSyml(lockFileContent);
  const isBerry = !!__metadata;

  const builder = new ProjectGraphBuilder();

  // we use key => node map to avoid duplicate work when parsing keys
  const keyMap = new Map<string, ProjectGraphExternalNode>();
  addNodes(dependencies, builder, keyMap, isBerry);
  addDependencies(dependencies, builder, keyMap);

  return builder.getUpdatedProjectGraph();
}

function addNodes(
  dependencies: Record<string, YarnDependency>,
  builder: ProjectGraphBuilder,
  keyMap: Map<string, ProjectGraphExternalNode>,
  isBerry: boolean
) {
  const nodesToadd: Map<
    string,
    Map<string, ProjectGraphExternalNode>
  > = new Map();

  Object.entries(dependencies).forEach(([keys, snapshot]) => {
    // ignore workspace projects
    if (snapshot.linkType === 'soft') {
      return;
    }
    const packageName = keys.slice(0, keys.indexOf('@', 1));
    const version = parseVersion(
      packageName,
      keys.split(', ')[0],
      snapshot,
      isBerry
    );
    keys.split(', ').forEach((key) => {
      // we don't need to keep duplicates, we can just track the keys
      const existingNode = nodesToadd.get(packageName)?.get(version);
      if (existingNode) {
        keyMap.set(key, existingNode);
        return;
      }

      const node: ProjectGraphExternalNode = {
        type: 'npm',
        name: `npm:${packageName}@${version}`,
        data: {
          version,
          packageName,
        },
      };

      if (!nodesToadd.has(packageName)) {
        nodesToadd.set(packageName, new Map());
      }
      nodesToadd.get(packageName).set(version, node);
      keyMap.set(key, node);
    });
  });

  for (const [packageName, versionMap] of nodesToadd.entries()) {
    let hoistedNode: ProjectGraphExternalNode;
    if (versionMap.size === 1) {
      hoistedNode = versionMap.values().next().value;
    } else {
      const hoistedVersion = getHoistedVersion(packageName);
      hoistedNode = versionMap.get(hoistedVersion);
    }
    hoistedNode.name = `npm:${packageName}`;

    versionMap.forEach((node) => {
      builder.addExternalNode(node);
    });
  }
}

function parseVersion(
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
    snapshot.resolution !== `${packageName}@npm:${snapshot.version}`
  ) {
    return snapshot.resolution.slice(packageName.length + 1);
  }
  if (!isBerry && !satisfies(snapshot.version, versionRange)) {
    return snapshot.resolved;
  }
  // otherwise it's a standard version
  return snapshot.version;
}

function getHoistedVersion(packageName: string): string {
  const version = getRootVersion(packageName);
  if (version) {
    return version;
  } else {
    throw new Error(`Cannot find hoisted version for ${packageName}`);
  }
}

function addDependencies(
  dependencies: Record<string, YarnDependency>,
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
            addNodeDependencies(node.name, section, builder, keyMap);
          }
        );
      }
    });
  });
}

function addNodeDependencies(
  source: string,
  section: Record<string, string>,
  builder: ProjectGraphBuilder,
  keyMap: Map<string, ProjectGraphExternalNode>
) {
  if (section) {
    Object.entries(section).forEach(([name, versionSpec]) => {
      const target =
        keyMap.get(`${name}@npm:${versionSpec}`) ||
        keyMap.get(`${name}@${versionSpec}`);
      if (target) {
        builder.addExternalNodeDependency(source, target.name);
      }
    });
  }
}

export function stringifyYarnLockfile(
  graph: ProjectGraph,
  rootLockFileContent: string,
  packageJson: NormalizedPackageJson
): string {
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
    return stringify(sortObjectByKeys(snapshots));
  }
}

function mapSnapshots(
  dependencies: Record<string, YarnDependency>,
  nodes: Record<string, ProjectGraphExternalNode>,
  packageJson: NormalizedPackageJson,
  isBerry: boolean
): Record<string, YarnDependency> {
  const snapshotMap: Map<YarnDependency, Set<string>> = new Map();
  const detectedDeps = new Map<string, Set<string>>();

  const addDependency = (packageName: string, version: string) => {
    if (!detectedDeps.has(packageName)) {
      detectedDeps.set(packageName, new Set());
    }
    detectedDeps.get(packageName).add(`${packageName}@${version}`);
    if (isBerry && !version.startsWith('npm:')) {
      detectedDeps.get(packageName).add(`${packageName}@npm:${version}`);
    }
  };

  let groupedDependencies: Record<string, YarnDependency>;
  if (isBerry) {
    groupedDependencies = dependencies;
  } else {
    // yarn classic splits keys when parsing so we need to stich them back together
    const resolutionMap = new Map<string, YarnDependency>();
    const snapshotMap = new Map<YarnDependency, Set<string>>();
    Object.entries(dependencies).forEach(([key, snapshot]) => {
      const resolutionKey = `${snapshot.resolution}${snapshot.integrity}`;
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
  }

  const combinedDependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...packageJson.optionalDependencies,
    ...packageJson.peerDependencies,
  };

  Object.values(nodes).forEach((node) => {
    const [matchedKeys, snapshot] = findOriginalKeys(groupedDependencies, node);
    snapshotMap.set(snapshot, new Set(matchedKeys));

    [snapshot.dependencies, snapshot.optionalDependencies].forEach(
      (section) => {
        Object.entries(section || {}).forEach(([name, versionSpec]) =>
          addDependency(name, versionSpec)
        );
      }
    );

    const requestedVersion = getPackageJsonVersion(combinedDependencies, node);
    if (requestedVersion) {
      addDependency(node.data.packageName, requestedVersion);
      const requestedKey = isBerry
        ? reverseMapBerryKey(node, requestedVersion, snapshot)
        : `${node.data.packageName}@${requestedVersion}`;
      if (!snapshotMap.get(snapshot).has(requestedKey)) {
        snapshotMap.get(snapshot).add(requestedKey);
      }
    }
  });

  snapshotMap.forEach((keysSet) => {
    for (const key of keysSet.values()) {
      const packageName = key.slice(0, key.indexOf('@', 1));
      try {
        if (!detectedDeps.get(packageName).has(key)) {
          keysSet.delete(key);
        }
      } catch (e) {
        console.log(packageName);
        throw e;
      }
    }
  });

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
    if (!keys[0].startsWith(`${node.data.packageName}@`)) {
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
      keys.every((k) => k === `${node.data.packageName}@${node.data.version}`)
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

const BERRY_LOCK_FILE_DISCLAIMER = `# This file was generated by Nx. Do not edit this file directly\n# Manual changes might be lost - proceed with caution!\n\n`;

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
