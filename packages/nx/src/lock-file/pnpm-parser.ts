import { LockFileBuilder, nodeKey } from './lock-file-builder';
import {
  LockFileEdge,
  LockFileGraph,
  LockFileNode,
  VersionedPackageSnapshot,
} from './utils/types';
import {
  PackageSnapshot,
  Lockfile,
  ProjectSnapshot,
  PackageSnapshots,
} from '@pnpm/lockfile-types';
import {
  loadPnpmHoistedDepsDefinition,
  parseAndNormalizePnpmLockfile,
  stringifyPnpmLockFile,
} from './utils/pnpm-utils';
import {
  addEdgeOuts,
  getRootVersion,
  reportUnresolvedDependencies,
  UnresolvedDependencies,
} from './utils/parsing-utils';
import { NormalizedPackageJson } from './utils/pruning-utils';
import { sortObjectByKeys } from '../utils/object-sort';

export function parsePnpmLockFile(lockFileContent: string): LockFileGraph {
  const data = parseAndNormalizePnpmLockfile(lockFileContent);
  const groupedDependencies = groupDependencies(data);

  const builder = buildLockFileGraph(groupedDependencies, data.importers);
  return builder.getLockFileGraph();
}

export function prunePnpmLockFile(
  rootLockFileContent: string,
  prunedPackageJson: NormalizedPackageJson
): string {
  const data = parseAndNormalizePnpmLockfile(rootLockFileContent);
  const groupedDependencies = groupDependencies(data);

  const builder = buildLockFileGraph(groupedDependencies, data.importers);
  builder.prune(prunedPackageJson);

  const output: Lockfile = {
    lockfileVersion: data.lockfileVersion,
    importers: {
      '.': mapRootSnapshot(prunedPackageJson, data.packages, builder.nodes),
    },
    packages: sortObjectByKeys(mapNodes(data.packages, builder.nodes)),
  };

  return stringifyPnpmLockFile(output);
}

function mapNodes(
  packages: PackageSnapshots,
  nodes: Map<string, LockFileNode>
): PackageSnapshots {
  const result: PackageSnapshots = {};
  for (const node of nodes.values()) {
    const { version, name, packageName } = node;
    const [key, snapshot] = findKey(packages, name, {
      version,
      packageName,
      returnFullKey: true,
    });
    // TODO: this has to be checked later, but it's not a deal breaker
    snapshot.dev = false;
    result[key] = snapshot;
  }
  return result;
}

function findKey(
  packages: PackageSnapshots,
  name: string,
  {
    version,
    packageName,
    returnFullKey,
  }: { version: string; packageName?: string; returnFullKey?: boolean }
): [string, PackageSnapshot] {
  for (const key of Object.keys(packages)) {
    const snapshot = packages[key];
    // standard package
    if (key.startsWith(`/${name}/${version}`)) {
      return [returnFullKey ? key : key.split('/').pop(), snapshot];
    }
    // tarball package
    if (key === version) {
      return [version, snapshot];
    }
    // tarball package variant 2
    if (snapshot.resolution?.['tarball'] === version) {
      return [snapshot.resolution['tarball'], snapshot];
    }
    // alias package
    if (packageName && key.startsWith(`/${packageName}/${version}`)) {
      return [key, snapshot];
    }
  }
}

function mapRootSnapshot(
  packageJson: NormalizedPackageJson,
  packages: PackageSnapshots,
  nodes: Map<string, LockFileNode>
): ProjectSnapshot {
  const findVersion = (
    packageName: string,
    specKey: string
  ): { version: string; packageName?: string } => {
    for (const node of nodes.values()) {
      if (
        node.name === packageName &&
        Array.from(node.edgesIn).some(
          (edge: LockFileEdge) => edge.versionSpec === specKey
        )
      ) {
        return { version: node.version, packageName: node.packageName };
      }
    }
  };

  const snapshot: ProjectSnapshot = { specifiers: {} };
  ['dependencies', 'optionalDependencies', 'devDependencies'].forEach(
    (depType) => {
      if (packageJson[depType]) {
        Object.keys(packageJson[depType]).forEach((packageName) => {
          const spec = packageJson[depType][packageName];
          snapshot.specifiers[packageName] = spec;
          snapshot[depType] = snapshot[depType] || {};
          snapshot[depType][packageName] = findKey(
            packages,
            packageName,
            findVersion(packageName, spec)
          )[0];
        });
      }
    }
  );
  // peer dependencies are mapped to dependencies
  if (packageJson.peerDependencies) {
    Object.keys(packageJson.peerDependencies).forEach((packageName) => {
      const spec = packageJson.peerDependencies[packageName];
      snapshot.specifiers[packageName] = spec;
      snapshot.dependencies = snapshot.dependencies || {};
      snapshot.dependencies[packageName] = findKey(
        packages,
        packageName,
        findVersion(packageName, spec)
      )[0];
    });
  }

  Object.keys(snapshot).forEach((key) => {
    snapshot[key] = sortObjectByKeys(snapshot[key]);
  });

  return snapshot;
}

function buildLockFileGraph(
  groupedDependencies: Map<
    string,
    Set<[string, string, VersionedPackageSnapshot]>
  >,
  rootSnapshots: Record<string, ProjectSnapshot>
): LockFileBuilder {
  const hoistedDependencies = loadPnpmHoistedDepsDefinition();
  const builder = new LockFileBuilder(rootSnapshots['.']);
  // parse workspace dependencies as incoming dependencies
  Object.keys(rootSnapshots).forEach((key) => {
    if (key !== '.') {
      builder.addWorkspaceIncomingEdges(rootSnapshots[key]);
    }
  });

  // Non-root dependencies that need to be resolved later
  // Map[packageName, specKey, PackageSnapshot]
  const unresolvedDependencies: UnresolvedDependencies<VersionedPackageSnapshot> =
    new Set<[string, string, VersionedPackageSnapshot]>();

  groupedDependencies.forEach((versionSet, packageName) => {
    versionSet.forEach(([specKey, originalKey, packageSnapshot]) => {
      const isRootVersion = isVersionHoisted(
        versionSet,
        rootSnapshots['.'],
        hoistedDependencies,
        packageName,
        originalKey,
        packageSnapshot
      );

      if (isRootVersion) {
        const node = parseNode(packageName, specKey, packageSnapshot, true);
        if (!builder.nodes.has(nodeKey(node))) {
          appendNodeAndEdges(builder, node, packageSnapshot, specKey);
        } else {
          const existingEdge = builder.nodes.get(nodeKey(node));
          builder.addEdgeIn(existingEdge, specKey);
        }
      } else {
        unresolvedDependencies.add([packageName, specKey, packageSnapshot]);
      }
    });
  });

  exhaustUnresolvedDependencies(builder, unresolvedDependencies);

  return builder;
}

function appendNodeAndEdges(
  builder: LockFileBuilder,
  node: LockFileNode,
  packageSnapshot: PackageSnapshot,
  version: string
) {
  builder.addNode(node);
  builder.addEdgeIn(node, version);

  if (packageSnapshot.peerDependenciesMeta) {
    // for pnpm, peerDependencies are always doubled in the dependencies if installed
    addEdgeOuts({
      builder,
      node,
      section: packageSnapshot.dependencies,
      isOptionalFunc: (depName) =>
        packageSnapshot.peerDependenciesMeta[depName]?.optional,
    });
  } else {
    addEdgeOuts({
      builder,
      node,
      section: packageSnapshot.dependencies,
    });
  }
  addEdgeOuts({
    builder,
    node,
    section: packageSnapshot.optionalDependencies,
  });
}

function isVersionHoisted(
  versionSet: Set<[string, string, VersionedPackageSnapshot]>,
  rootSnapshot: ProjectSnapshot,
  hoistedDependencies: Record<string, any>,
  packageName: string,
  key: string,
  packageSnapshot: PackageSnapshot
): boolean {
  // if there's only one version, it's automatically hoisted
  if (versionSet.size === 1) {
    return true;
  }
  // if dependency is defined in importers that has priority
  if (rootSnapshot.dependencies?.[packageName]) {
    return (
      rootSnapshot.dependencies[packageName] ===
      key.slice(key.lastIndexOf('/') + 1)
    );
  }
  if (rootSnapshot.devDependencies?.[packageName]) {
    return (
      rootSnapshot.devDependencies[packageName] ===
      key.slice(key.lastIndexOf('/') + 1)
    );
  }
  // some hoisted dependencies are in node_modules/{packageName} while others are in node_modules/.pnpm/{packageName}@{version}
  // modules.yaml provides better specificity than node_modules/{packageName}
  const nonVersionedKey = key.split('_')[0];
  if (
    Object.keys(hoistedDependencies).some((k) => k.startsWith(nonVersionedKey))
  ) {
    return !!hoistedDependencies[key];
  }
  const rootVersion = getRootVersion(packageName);
  return packageSnapshot.version === rootVersion;
}

function parseVersionSpec(key: string, packageName: string): string {
  if (key.startsWith(`/${packageName}/`)) {
    return key.slice(key.lastIndexOf('/') + 1);
  }
  // for alias or tarball packlage the entire key is the version spec
  return key;
}

function parseNode(
  packageName: string,
  versionSpec: string,
  snapshot: PackageSnapshot,
  isHoisted: boolean
): LockFileNode {
  const resolution = snapshot.resolution;

  let name = snapshot.name;
  // for tarball packages, the version of the snapshot is not accurate
  let version = resolution['tarball'] || snapshot.version;

  const node: LockFileNode = {
    name: name || packageName,
    ...(version && { version }),
    isHoisted,
  };

  if (!name && versionSpec.startsWith('/')) {
    node.packageName = versionSpec.slice(1, versionSpec.lastIndexOf('/'));
  }

  return node;
}

function groupDependencies(
  data: Lockfile
): Map<string, Set<[string, string, VersionedPackageSnapshot]>> {
  // packageName => Set[versionSpec, originalKey, PackageSnapshot]
  const groupedDependencies = new Map<
    string,
    Set<[string, string, VersionedPackageSnapshot]>
  >();

  Object.entries(data.packages).forEach(([key, value]) => {
    const packageName = findPackageName(key, value, data);
    const versionSpec = parseVersionSpec(key, packageName);
    const version =
      value.version ||
      versionSpec.slice(versionSpec.lastIndexOf('/') + 1).split('_')[0];
    const snapshot = { ...value, version };

    if (!groupedDependencies.has(packageName)) {
      groupedDependencies.set(
        packageName,
        new Set<[string, string, VersionedPackageSnapshot]>().add([
          versionSpec,
          key,
          snapshot,
        ])
      );
    } else {
      groupedDependencies.get(packageName).add([versionSpec, key, snapshot]);
    }
  });
  return groupedDependencies;
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

  if (value.name) {
    return value.name;
  }
  const rootDependencyName =
    matchedDependencyName(data.importers['.']) ||
    // only root importers have devDependencies
    matchPropValue(data.importers['.'].devDependencies);
  if (rootDependencyName) {
    return rootDependencyName;
  }
  const snapshots = Object.values(data.packages);
  for (let i = 0; i < snapshots.length; i++) {
    const snapshot = snapshots[i];
    const dependencyName = matchedDependencyName(snapshot);
    if (dependencyName) {
      return dependencyName;
    }
  }
  return key.startsWith('/') ? key.slice(1, key.lastIndexOf('/')) : key;
}

function exhaustUnresolvedDependencies(
  builder: LockFileBuilder,
  unresolvedDependencies: UnresolvedDependencies<PackageSnapshot>
) {
  const initialSize = unresolvedDependencies.size;
  if (!initialSize) {
    return;
  }

  unresolvedDependencies.forEach((unresolvedSet) => {
    const [packageName, versionSpec, packageSnapshot] = unresolvedSet;

    for (const n of builder.nodes.values()) {
      if (n.edgesOut && n.edgesOut.has(packageName)) {
        const edge = n.edgesOut.get(packageName);

        if (edge.versionSpec === versionSpec) {
          const node = parseNode(
            packageName,
            versionSpec,
            packageSnapshot,
            false
          );

          // we might have added the node already
          if (!builder.nodes.has(nodeKey(node))) {
            appendNodeAndEdges(builder, node, packageSnapshot, versionSpec);
          } else {
            const existingNode = builder.nodes.get(nodeKey(node));
            builder.addEdgeIn(existingNode, versionSpec);
          }
          unresolvedDependencies.delete(unresolvedSet);
          return;
        }
      }
      if (builder.isIncomingPackage(packageName, versionSpec)) {
        const node = parseNode(
          packageName,
          versionSpec,
          packageSnapshot,
          false
        );
        appendNodeAndEdges(builder, node, packageSnapshot, versionSpec);
        unresolvedDependencies.delete(unresolvedSet);
        return;
      }
    }
  });

  if (initialSize === unresolvedDependencies.size) {
    // ignore packages that were parsed already with different hashmap
    unresolvedDependencies.forEach((unresolvedDependency) => {
      const [packageName, versionSpec] = unresolvedDependency;
      if (builder.nodes.has(`${packageName}@${versionSpec.split('_')[0]}`)) {
        unresolvedDependencies.delete(unresolvedDependency);
      }
    });
  }

  if (initialSize === unresolvedDependencies.size) {
    reportUnresolvedDependencies(unresolvedDependencies);
  } else if (unresolvedDependencies.size > 0) {
    exhaustUnresolvedDependencies(builder, unresolvedDependencies);
  }
}
