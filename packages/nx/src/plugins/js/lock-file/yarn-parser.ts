import {
  getHoistedPackageVersion,
  NormalizedPackageJson,
} from './utils/package-json';
import {
  RawProjectGraphDependency,
  validateDependency,
} from '../../../project-graph/project-graph-builder';
import { gt, Range, satisfies } from 'semver';
import {
  DependencyType,
  ProjectGraph,
  ProjectGraphExternalNode,
} from '../../../config/project-graph';
import { hashArray } from '../../../hasher/file-hasher';
import { sortObjectByKeys } from '../../../utils/object-sort';
import { CreateDependenciesContext } from '../../../project-graph/plugins';

/**
 * Yarn
 * - Classic has resolved and integrity
 * - Berry has resolution, checksum, languageName and linkType
 */
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

let currentLockFileHash: string;
let cachedParsedLockFile;

// we use key => node map to avoid duplicate work when parsing keys
let keyMap = new Map<string, ProjectGraphExternalNode>();

function parseLockFile(lockFileContent: string, lockFileHash: string) {
  if (currentLockFileHash === lockFileHash) {
    return cachedParsedLockFile;
  }

  const { parseSyml } =
    require('@yarnpkg/parsers') as typeof import('@yarnpkg/parsers');

  keyMap.clear();
  const result = parseSyml(lockFileContent);
  cachedParsedLockFile = result;
  currentLockFileHash = lockFileHash;
  return result;
}

export function getYarnLockfileNodes(
  lockFileContent: string,
  lockFileHash: string,
  packageJson: NormalizedPackageJson
) {
  const { __metadata, ...dependencies } = parseLockFile(
    lockFileContent,
    lockFileHash
  );

  const isBerry = !!__metadata;

  // yarn classic splits keys when parsing so we need to stich them back together
  const groupedDependencies = groupDependencies(dependencies, isBerry);

  return getNodes(groupedDependencies, packageJson, isBerry);
}

export function getYarnLockfileDependencies(
  lockFileContent: string,
  lockFileHash: string,
  ctx: CreateDependenciesContext
) {
  const { __metadata, ...dependencies } = parseLockFile(
    lockFileContent,
    lockFileHash
  );

  const isBerry = !!__metadata;

  // yarn classic splits keys when parsing so we need to stich them back together
  const groupedDependencies = groupDependencies(dependencies, isBerry);

  return getDependencies(groupedDependencies, ctx);
}

function getPackageNameKeyPairs(keys: string): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  keys.split(', ').forEach((key) => {
    const packageName = key.slice(0, key.indexOf('@', 1));
    if (result.has(packageName)) {
      result.get(packageName).add(key);
    } else {
      result.set(packageName, new Set([key]));
    }
  });
  return result;
}

function getNodes(
  dependencies: Record<string, YarnDependency>,
  packageJson: NormalizedPackageJson,
  isBerry: boolean
) {
  const nodes: Map<string, Map<string, ProjectGraphExternalNode>> = new Map();
  const combinedDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...packageJson.peerDependencies,
    ...packageJson.optionalDependencies,
  };

  Object.entries(dependencies).forEach(([keys, snapshot]) => {
    // ignore workspace projects & patches
    if (snapshot.linkType === 'soft' || keys.includes('@patch:')) {
      return;
    }
    const nameKeyPairs = getPackageNameKeyPairs(keys);
    nameKeyPairs.forEach((keySet, packageName) => {
      const keysArray = Array.from(keySet);
      // use key relevant to the package name
      const [version, isAlias] = findVersion(
        packageName,
        keysArray[0],
        snapshot,
        isBerry
      );

      // use keys linked to the extracted package name
      keysArray.forEach((key) => {
        // we don't need to keep duplicates, we can just track the keys
        const existingNode = nodes.get(packageName)?.get(version);
        if (existingNode) {
          keyMap.set(key, existingNode);
          return;
        }

        const node: ProjectGraphExternalNode = {
          type: 'npm',
          name:
            version && !isAlias
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
        // use actual version so we can detect it later based on npm package's version
        const mapKey =
          snapshot.version && version !== snapshot.version
            ? snapshot.version
            : version;
        if (!nodes.has(packageName)) {
          nodes.set(packageName, new Map([[mapKey, node]]));
        } else {
          nodes.get(packageName).set(mapKey, node);
        }
      });
    });
  });

  const externalNodes: Record<string, ProjectGraphExternalNode> = {};
  for (const [packageName, versionMap] of nodes.entries()) {
    const hoistedNode = findHoistedNode(packageName, versionMap, combinedDeps);
    if (hoistedNode) {
      hoistedNode.name = `npm:${packageName}`;
    }

    versionMap.forEach((node) => {
      externalNodes[node.name] = node;
    });
  }
  return externalNodes;
}

function findHoistedNode(
  packageName: string,
  versionMap: Map<string, ProjectGraphExternalNode>,
  combinedDeps: Record<string, string>
): ProjectGraphExternalNode {
  const hoistedVersion = getHoistedVersion(packageName);
  if (hoistedVersion) {
    return versionMap.get(hoistedVersion);
  }
  const rootVersionSpecifier = combinedDeps[packageName];
  if (!rootVersionSpecifier) {
    return;
  }
  const versions = Array.from(versionMap.keys()).sort((a, b) =>
    gt(a, b) ? -1 : 1
  );
  // take the highest version found
  if (rootVersionSpecifier === '*') {
    return versionMap.get(versions[0]);
  }
  // take version that satisfies the root version specifier
  let version = versions.find((v) => satisfies(v, rootVersionSpecifier));
  if (!version) {
    // try to find alias version
    version = versions.find(
      (v) =>
        versionMap.get(v).name === `npm:${packageName}@${rootVersionSpecifier}`
    );
  }
  if (!version) {
    // try to find tarball package
    version = versions.find((v) => versionMap.get(v).data.version !== v);
  }
  if (version) {
    return versionMap.get(version);
  }
}

function findVersion(
  packageName: string,
  key: string,
  snapshot: YarnDependency,
  isBerry: boolean
): [string, boolean] | [string] {
  const versionRange = key.slice(key.indexOf('@', 1) + 1);
  // check for alias packages
  const isAlias = isBerry
    ? snapshot.resolution && !snapshot.resolution.startsWith(`${packageName}@`)
    : versionRange.startsWith('npm:');

  if (isAlias) {
    return [versionRange, true];
  }
  // check for berry tarball packages
  if (
    isBerry &&
    snapshot.resolution &&
    // different registry would yield suffix following '::' which we don't need
    snapshot.resolution.split('::')[0] !==
      `${packageName}@npm:${snapshot.version}`
  ) {
    return [snapshot.resolution.slice(packageName.length + 1)];
  }

  if (!isBerry && isTarballPackage(versionRange, snapshot)) {
    return [snapshot.resolved];
  }
  // otherwise it's a standard version
  return [snapshot.version];
}

// check if snapshot represents tarball package
function isTarballPackage(
  versionRange: string,
  snapshot: YarnDependency
): boolean {
  // if resolved is missing it's internal link
  if (!snapshot.resolved) {
    return false;
  }
  // tarballs have no integrity
  if (snapshot.integrity) {
    return false;
  }
  try {
    new Range(versionRange);
    // range is a valid semver
    return false;
  } catch {
    // range is not a valid semver, it can be an npm tag or url part of a tarball
    return snapshot.version && !snapshot.resolved.includes(snapshot.version);
  }
}

function getHoistedVersion(packageName: string): string {
  const version = getHoistedPackageVersion(packageName);
  if (version) {
    return version;
  }
}

function getDependencies(
  dependencies: Record<string, YarnDependency>,
  ctx: CreateDependenciesContext
) {
  const projectGraphDependencies: RawProjectGraphDependency[] = [];
  Object.keys(dependencies).forEach((keys) => {
    const snapshot = dependencies[keys];
    keys.split(', ').forEach((key) => {
      if (keyMap.has(key)) {
        const node = keyMap.get(key);
        [snapshot.dependencies, snapshot.optionalDependencies].forEach(
          (section) => {
            if (section) {
              Object.entries(section).forEach(([name, versionRange]) => {
                let target =
                  keyMap.get(`${name}@npm:${versionRange}`) ||
                  keyMap.get(`${name}@${versionRange}`);
                if (!target) {
                  const shortRange = versionRange.replace(/^npm:/, '');
                  // for range like 'npm:*' the above will not be a match
                  if (shortRange === '*') {
                    const foundKey = Array.from(keyMap.keys()).find((k) =>
                      k.startsWith(`${name}@`)
                    );
                    if (foundKey) {
                      target = keyMap.get(foundKey);
                    }
                  } else if (shortRange.includes('||')) {
                    // when range is a union of ranges, we need to treat it as an array
                    const ranges = shortRange.split('||').map((r) => r.trim());
                    target = Object.values(keyMap).find((n) => {
                      return (
                        n.data.packageName === name &&
                        ranges.some((r) => satisfies(n.data.version, r))
                      );
                    })?.[1];
                  }
                }
                if (target) {
                  const dep: RawProjectGraphDependency = {
                    source: node.name,
                    target: target.name,
                    type: DependencyType.static,
                  };
                  validateDependency(dep, ctx);
                  projectGraphDependencies.push(dep);
                }
              });
            }
          }
        );
      }
    });
  });

  return projectGraphDependencies;
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
  dependencies: Record<string, YarnDependency>,
  isBerry: boolean
): Record<string, YarnDependency> {
  if (isBerry) {
    return dependencies;
  }
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
  if (isBerry && !version.startsWith('npm:') && !version.startsWith('patch:')) {
    collection.get(packageName).add(`${packageName}@npm:${version}`);
  }
}

function mapSnapshots(
  rootDependencies: Record<string, YarnDependency>,
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
  const resolutions = {
    ...packageJson.resolutions,
  };

  // yarn classic splits keys when parsing so we need to stich them back together
  const groupedDependencies = groupDependencies(rootDependencies, isBerry);

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
    const requestedResolutionsVersion = getPackageJsonVersion(
      resolutions,
      node
    );
    if (requestedResolutionsVersion) {
      addPackageVersion(
        node.data.packageName,
        requestedResolutionsVersion,
        existingKeys,
        isBerry
      );
      const requestedKey = isBerry
        ? reverseMapBerryKey(node, requestedResolutionsVersion, snapshot)
        : `${node.data.packageName}@${requestedResolutionsVersion}`;
      if (!snapshotMap.get(snapshot).has(requestedKey)) {
        snapshotMap.get(snapshot).add(requestedKey);
      }
    }

    if (isBerry) {
      // look for patched versions
      const patch = findPatchedKeys(
        groupedDependencies,
        node,
        resolutions[node.data.packageName]
      );
      if (patch) {
        const [matchedKeys, snapshot] = patch;
        snapshotMap.set(snapshot, new Set(matchedKeys));
      }
    }
  });

  // remove keys that match version ranges that have been pruned away
  snapshotMap.forEach((snapshotValue, snapshot) => {
    for (const key of snapshotValue.values()) {
      const packageName = key.slice(0, key.indexOf('@', 1));
      let normalizedKey = key;
      if (isBerry && key.includes('@patch:') && key.includes('#')) {
        const regEx = new RegExp(`@patch:${packageName}@(npm%3A)?(.*)$`);
        normalizedKey = key
          .slice(0, key.indexOf('#'))
          .replace(regEx, '@npm:$2');
      }
      if (
        !existingKeys.get(packageName) ||
        !existingKeys.get(packageName).has(normalizedKey)
      ) {
        snapshotValue.delete(key);
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
  if (version.startsWith('npm:') || version.startsWith('patch:')) {
    return `${node.data.packageName}@${version}`;
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
  dependencies: Record<string, string>,
  node: ProjectGraphExternalNode
): string {
  const { packageName, version } = node.data;

  if (dependencies[packageName]) {
    const patchRegex = new RegExp(`^patch:${packageName}@(.*)|#.*$`);
    // extract the version from the patch or use the full version
    const versionRange =
      dependencies[packageName].match(patchRegex)?.[1] ||
      dependencies[packageName];
    if (versionRange === version || satisfies(version, versionRange)) {
      return dependencies[packageName];
    }
  }
}

function isStandardPackage(snapshot: YarnDependency, version: string): boolean {
  return snapshot.version === version;
}

function isBerryAlias(snapshot: YarnDependency, version: string): boolean {
  return snapshot.resolution && `npm:${snapshot.resolution}` === version;
}

function isClassicAlias(
  node: ProjectGraphExternalNode,
  keys: string[]
): boolean {
  return (
    node.data.version.startsWith('npm:') &&
    keys.some((k) => k === `${node.data.packageName}@${node.data.version}`)
  );
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
    if (
      isStandardPackage(snapshot, node.data.version) ||
      isBerryAlias(snapshot, node.data.version) ||
      isClassicAlias(node, keys)
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
  node: ProjectGraphExternalNode,
  resolutionVersion: string
): [string[], YarnDependency] | void {
  for (const keyExpr of Object.keys(dependencies)) {
    const snapshot = dependencies[keyExpr];
    const keys = keyExpr.split(', ');
    if (!keys[0].startsWith(`${node.data.packageName}@patch:`)) {
      continue;
    }
    if (keyExpr.includes('.yarn/patches')) {
      if (!resolutionVersion) {
        continue;
      }
      const key = `${node.data.packageName}@${resolutionVersion}`;
      // local patches can have different location from than the root lock file
      // use the one from local package.json as the source of truth as long as the rest of the patch matches
      // this obviously doesn't cover the case of patch over a patch, but that's a super rare case and one can argue one can just join those two patches
      if (key.split('::locator')[0] !== keyExpr.split('::locator')[0]) {
        continue;
      } else {
        return [[key], { ...snapshot, resolution: key }];
      }
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
  let isVersion4 = false;
  if (!!packageJson.packageManager) {
    const [_, version] = packageJson.packageManager.split('@');
    isVersion4 = !!version && satisfies(version, '>=4.0.0');
  }

  const reducer = (acc, [name, version]) => {
    acc[name] = isVersion4 ? `npm:${version}` : version;
    return acc;
  };

  return {
    version: '0.0.0-use.local',
    resolution: `${packageJson.name}@workspace:.`,
    ...(packageJson.dependencies && {
      dependencies: Object.entries(packageJson.dependencies).reduce(
        reducer,
        {}
      ),
    }),
    ...(packageJson.peerDependencies && {
      peerDependencies: Object.entries(packageJson.peerDependencies).reduce(
        reducer,
        {}
      ),
    }),
    ...(packageJson.devDependencies && {
      devDependencies: Object.entries(packageJson.devDependencies).reduce(
        reducer,
        {}
      ),
    }),
    ...(packageJson.optionalDependencies && {
      optionalDependencies: Object.entries(
        packageJson.optionalDependencies
      ).reduce(reducer, {}),
    }),
    languageName: 'unknown',
    linkType: 'soft',
  };
}
