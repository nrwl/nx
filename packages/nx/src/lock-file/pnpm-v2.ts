import { PackageJson } from '../utils/package-json';
import {
  LockFileBuilder,
  LockFileGraph,
  LockFileNode,
} from './utils/lock-file-builder';
import { PackageSnapshot, Lockfile } from '@pnpm/lockfile-types';
import {
  loadPnpmHoistedDepsDefinition,
  parseAndNormalizePnpmLockfile,
} from './utils/pnpm-helpers';
import { workspaceRoot } from '../utils/workspace-root';
import { existsSync, readFileSync } from 'fs';

type VersionedPackageSnapshot = PackageSnapshot & { version?: string };

export function parsePnpmLockFile(
  lockFileContent: string,
  packageJson: PackageJson
): LockFileGraph {
  const data = parseAndNormalizePnpmLockfile(lockFileContent);
  const hoistedDependencies = loadPnpmHoistedDepsDefinition();
  const groupedDependencies = groupDependencies(data);

  const builder = new LockFileBuilder({
    packageJson: data.importers['.'],
    lockFileContent,
  });

  // Non-root dependencies that need to be resolved later
  // Map[packageName, specKey, PackageSnapshot]
  const unresolvedDependencies = new Set<
    [string, string, VersionedPackageSnapshot]
  >();

  groupedDependencies.forEach((versionSet, packageName) => {
    versionSet.forEach(([specKey, originalKey, packageSnapshot]) => {
      // If there is only one version, it is the root version
      // otherwise we consult hoistedDependencies to see if it is a root version
      let isRootVersion;
      if (versionSet.size === 1) {
        isRootVersion = true;
      } else {
        // some hoisted dependencies are in node_modules/{packageName} while others are in node_modules/.pnpm/{packageName}@{version}
        const rootVersion = getRootVersion(packageName);

        if (rootVersion) {
          isRootVersion = packageSnapshot.version === rootVersion;
        } else {
          isRootVersion = !!hoistedDependencies[originalKey];
        }
      }

      if (isRootVersion) {
        const path = `node_modules/${packageName}`;
        const node = parseNode(packageName, path, specKey, packageSnapshot);
        builder.addNode(path, node);

        builder.addEdgeIn(node, specKey);
        if (packageSnapshot.dependencies) {
          Object.entries(packageSnapshot.dependencies).forEach(
            ([depName, depSpec]) => {
              // for pnpm, peerDependencies are always doubled in the dependencies if installed
              const isOptional =
                packageSnapshot.peerDependenciesMeta?.[depName]?.optional;
              builder.addEdgeOut(node, depName, depSpec, isOptional);
            }
          );
        }
        if (packageSnapshot.optionalDependencies) {
          Object.entries(packageSnapshot.optionalDependencies).forEach(
            ([depName, depSpec]) => {
              builder.addEdgeOut(node, depName, depSpec, true);
            }
          );
        }
        // TODO: what does transitivePeerDependencies represents?
      } else {
        unresolvedDependencies.add([packageName, specKey, packageSnapshot]);
      }
    });
  });

  exhaustUnresolvedDependencies(builder, unresolvedDependencies);

  return builder.getLockFileGraph();
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
  path: string,
  versionSpec: string,
  snapshot: PackageSnapshot
): LockFileNode {
  const resolution = snapshot.resolution;

  let name = snapshot.name;
  // for tarball packages, the version of the snapshot is not accurate
  let version = resolution['tarball'] || snapshot.version;

  const node: LockFileNode = {
    name: name || packageName,
    ...(version && { version }),
    path,
    ...(resolution && {
      integrity: resolution['integrity'] || resolution['tarball'],
    }),
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

// find the top-most parent node that doesn't have the dependency
function findTopParentPath(
  builder: LockFileBuilder,
  parentNode: LockFileNode,
  packageName: string
): string {
  let path;

  while (!parentNode.children?.has(packageName)) {
    path = parentNode.path;
    const searchPath = `node_modules/${parentNode.name}`;

    if (path === searchPath) {
      parentNode = builder.nodes.get('');
    } else {
      parentNode = builder.nodes.get(path.slice(0, -(searchPath.length + 1)));
    }
  }

  return path;
}

function exhaustUnresolvedDependencies(
  builder: LockFileBuilder,
  unresolvedDependencies: Set<[string, string, PackageSnapshot]>
) {
  const initialSize = unresolvedDependencies.size;
  unresolvedDependencies.forEach((unresolvedSet) => {
    const [packageName, versionSpec, packageSnapshot] = unresolvedSet;

    for (const n of builder.nodes.values()) {
      if (n.edgesOut && n.edgesOut.has(packageName)) {
        const edge = n.edgesOut.get(packageName);

        if (edge.versionSpec === versionSpec) {
          const parentPath = findTopParentPath(builder, n, packageName);
          const path = `${parentPath}/node_modules/${packageName}`;
          const node = parseNode(
            packageName,
            path,
            versionSpec,
            packageSnapshot
          );
          builder.addNode(path, node);
          if (packageSnapshot.dependencies) {
            Object.entries(packageSnapshot.dependencies).forEach(
              ([depName, depSpec]) => {
                // for pnpm, peerDependencies are always doubled in the dependencies if installed
                const isOptional =
                  packageSnapshot.peerDependenciesMeta?.[depName]?.optional;
                builder.addEdgeOut(node, depName, depSpec, isOptional);
              }
            );
          }
          if (packageSnapshot.optionalDependencies) {
            Object.entries(packageSnapshot.optionalDependencies).forEach(
              ([depName, depSpec]) => {
                builder.addEdgeOut(node, depName, depSpec, true);
              }
            );
          }
          unresolvedDependencies.delete(unresolvedSet);
          return;
        }
      }
    }
  });

  if (initialSize === unresolvedDependencies.size) {
    throw new Error(
      `Could not resolve following dependencies\n` +
        Array.from(unresolvedDependencies)
          .map(
            ([packageName, versionSpec]) => `- ${packageName}@${versionSpec}\n`
          )
          .join('') +
        `Breaking out of the parsing to avoid infinite loop.`
    );
  }
  if (unresolvedDependencies.size > 0) {
    exhaustUnresolvedDependencies(builder, unresolvedDependencies);
  }
}

function getRootVersion(packageName: string): string {
  const fullPath = `${workspaceRoot}/node_modules/${packageName}/package.json`;

  if (existsSync(fullPath)) {
    const content = readFileSync(fullPath, 'utf-8');
    return JSON.parse(content).version;
  } else {
    return;
  }
}
