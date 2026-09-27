import {
  ProjectGraph,
  ProjectGraphExternalNode,
} from '../../../../config/project-graph';
import { reverse } from '../../../../project-graph/operators';
import type {
  NpmDependencyV1,
  NpmDependencyV3,
  NpmLockFile,
} from '../npm-parser';
import { findNodeMatchingVersion } from '../project-graph-pruning';
import { NormalizedPackageJson } from './package-json';

/**
 * Places the root lock file's snapshots at their paths in the pruned npm lock
 * file, where the pruned package is the root.
 */

export type MappedPackage = {
  path: string;
  name: string;
  // the graph node placed at `path`
  node: string;
  valueV3?: NpmDependencyV3;
  valueV1?: NpmDependencyV1;
};

export function mapSnapshots(
  rootLockFile: NpmLockFile,
  graph: ProjectGraph,
  packageJson: NormalizedPackageJson
): MappedPackage[] {
  const nestedNodes = new Set<ProjectGraphExternalNode>();
  const visitedNodes = new Map<
    ProjectGraphExternalNode,
    {
      packagePaths: Set<string>;
      unresolvedParents: Set<string>;
    }
  >();
  const remappedPackages: Map<string, MappedPackage> = new Map();
  const packageIndex = buildV3Index(rootLockFile.packages);
  const rootNodes = getRootNodes(graph, packageJson);

  // add first level children
  Object.values(graph.externalNodes).forEach((node) => {
    if (rootNodes.get(node.data.packageName) === node) {
      const mappedPackage = mapPackage(
        rootLockFile,
        packageIndex,
        node.data.packageName,
        node.data.version,
        '',
        node.name
      );
      remappedPackages.set(mappedPackage.path, mappedPackage);
      visitedNodes.set(node, {
        packagePaths: new Set([mappedPackage.path]),
        unresolvedParents: new Set(),
      });
    } else {
      nestedNodes.add(node);
    }
  });

  let remappedPackagesArray: MappedPackage[];
  if (nestedNodes.size) {
    const invertedGraph = reverse(graph);
    nestMappedPackages(
      invertedGraph,
      remappedPackages,
      nestedNodes,
      visitedNodes,
      rootLockFile,
      packageIndex
    );
    // initially we naively map package paths to topParent/../parent/child
    // but some of those should be nested higher up the tree
    remappedPackagesArray = elevateNestedPaths(remappedPackages);
  } else {
    remappedPackagesArray = Array.from(remappedPackages.values());
  }
  return repairResolution(
    remappedPackagesArray,
    graph,
    rootLockFile,
    packageIndex
  ).sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * The version placed at `node_modules/<name>`: the one the pruned package
 * depends on directly, as npm gives its root package, otherwise the version the
 * root lock file hoisted. In a workspace npm nests a member's own dependency
 * under the member when another one holds the root slot; the pruned package is
 * the root here, so its version takes the slot, and the hoisted version it
 * displaces is nested below its dependents like any other.
 */
function getRootNodes(
  graph: ProjectGraph,
  packageJson: NormalizedPackageJson
): Map<string, ProjectGraphExternalNode> {
  const rootNodes = new Map<string, ProjectGraphExternalNode>();
  const declared = {
    ...packageJson.peerDependencies,
    ...packageJson.optionalDependencies,
    ...packageJson.devDependencies,
    ...packageJson.dependencies,
  };
  for (const [name, versionExpr] of Object.entries(declared)) {
    const node = findNodeMatchingVersion(graph, name, versionExpr);
    if (node) {
      rootNodes.set(name, node);
    }
  }
  for (const node of Object.values(graph.externalNodes)) {
    if (
      node.name === `npm:${node.data.packageName}` &&
      !rootNodes.has(node.data.packageName)
    ) {
      rootNodes.set(node.data.packageName, node);
    }
  }
  return rootNodes;
}

/**
 * Nesting each version under its dependents and then elevating it as far as it
 * goes never checks what a package resolves from where it lands, so a nearer
 * copy of a name can shadow the version it depends on: z@1 nested under x
 * picks up x's m@1 instead of the m@2 it needs. Where a package's dependency
 * resolves to another version, or to nothing, nest the version it depends on
 * directly under it. That copy can shadow the name for packages below it, so
 * those are checked again. Peer dependencies are left alone: a copy of a peer
 * under every dependent would duplicate it rather than share it.
 */
function repairResolution(
  mappedPackages: MappedPackage[],
  graph: ProjectGraph,
  rootLockFile: NpmLockFile,
  packageIndex: V3Index
): MappedPackage[] {
  const placed = new Map(mappedPackages.map((p) => [p.path, p]));
  const queue = Array.from(placed.keys());
  while (queue.length) {
    const path = queue.pop();
    const mapped = placed.get(path);
    const declared = new Set(
      Object.keys({
        ...mapped.valueV3?.dependencies,
        ...mapped.valueV3?.optionalDependencies,
        ...mapped.valueV1?.requires,
      })
    );
    const targets = new Map<string, ProjectGraphExternalNode[]>();
    for (const { target } of graph.dependencies[mapped.node] ?? []) {
      const targetNode = graph.externalNodes[target];
      const name = targetNode?.data.packageName;
      if (!targetNode || !declared.has(name)) {
        continue;
      }
      targets.set(name, [...(targets.get(name) ?? []), targetNode]);
    }
    for (const [name, candidates] of targets) {
      const resolved = placed.get(resolvePlacedPath(placed, path, name));
      if (resolved && candidates.some((c) => c.name === resolved.node)) {
        continue;
      }
      const copy = mapPackage(
        rootLockFile,
        packageIndex,
        name,
        candidates[0].data.version,
        path + '/',
        candidates[0].name
      );
      placed.set(copy.path, copy);
      queue.push(copy.path);
      for (const below of placed.keys()) {
        if (below !== copy.path && below.startsWith(`${path}/node_modules/`)) {
          queue.push(below);
        }
      }
    }
  }
  return Array.from(placed.values());
}

// Node's lookup from a package at `path`: its own node_modules, then each
// enclosing package's, then the root's.
function resolvePlacedPath(
  placed: Map<string, MappedPackage>,
  path: string,
  name: string
): string | undefined {
  for (let dir = path; ;) {
    const candidate = dir
      ? `${dir}/node_modules/${name}`
      : `node_modules/${name}`;
    if (placed.has(candidate)) {
      return candidate;
    }
    if (!dir) {
      return undefined;
    }
    const parent = dir.lastIndexOf('/node_modules/');
    dir = parent === -1 ? '' : dir.slice(0, parent);
  }
}

function mapPackage(
  rootLockFile: NpmLockFile,
  packageIndex: V3Index,
  packageName: string,
  version: string,
  parentPath: string,
  node: string
): MappedPackage {
  const lockfileVersion = rootLockFile.lockfileVersion;

  let valueV3, valueV1;
  if (lockfileVersion < 3) {
    valueV1 = findMatchingPackageV1(
      rootLockFile.dependencies,
      packageName,
      version
    );
  }
  if (lockfileVersion > 1) {
    valueV3 = findMatchingPackageV3(packageIndex, packageName, version);
  }

  return {
    path: parentPath + `node_modules/${packageName}`,
    name: packageName,
    node,
    valueV1,
    valueV3,
  };
}

function nestMappedPackages(
  invertedGraph: ProjectGraph,
  result: Map<string, MappedPackage>,
  nestedNodes: Set<ProjectGraphExternalNode>,
  visitedNodes: Map<
    ProjectGraphExternalNode,
    {
      packagePaths: Set<string>;
      unresolvedParents: Set<string>;
    }
  >,
  rootLockFile: NpmLockFile,
  packageIndex: V3Index
) {
  const initialSize = nestedNodes.size;

  if (!initialSize) {
    return;
  }

  nestedNodes.forEach((node) => {
    // Only a package places another: the pruned package is the root, and the
    // edges of workspace projects, which the pruned graph still carries, lead
    // nowhere in the pruned tree.
    const parents = invertedGraph.dependencies[node.name]
      .map(({ target }) => target)
      .filter((target) => invertedGraph.externalNodes[target]);
    if (!visitedNodes.has(node)) {
      visitedNodes.set(node, {
        packagePaths: new Set(),
        unresolvedParents: new Set(parents),
      });
    }

    parents.forEach((target) => {
      if (!visitedNodes.get(node).unresolvedParents.has(target)) {
        return;
      }

      const targetNode = invertedGraph.externalNodes[target];
      if (
        visitedNodes.has(targetNode) &&
        !visitedNodes.get(targetNode).unresolvedParents.size
      ) {
        visitedNodes.get(targetNode).packagePaths.forEach((path) => {
          const mappedPackage = mapPackage(
            rootLockFile,
            packageIndex,
            node.data.packageName,
            node.data.version,
            path + '/',
            node.name
          );
          result.set(mappedPackage.path, mappedPackage);
          visitedNodes.get(node).packagePaths.add(mappedPackage.path);
        });
        // a parent placed nowhere contributes no path, but no longer blocks
        visitedNodes.get(node).unresolvedParents.delete(target);
      }
    });
    if (!visitedNodes.get(node).unresolvedParents.size) {
      nestedNodes.delete(node);
    }
  });

  if (initialSize === nestedNodes.size) {
    // What is left waits on parents that are never placed; repairResolution
    // places whatever a placed package still needs.
    return;
  } else {
    nestMappedPackages(
      invertedGraph,
      result,
      nestedNodes,
      visitedNodes,
      rootLockFile,
      packageIndex
    );
  }
}

// sort paths by number of segments and then alphabetically
function sortMappedPackagesPaths(mappedPackages: Map<string, MappedPackage>) {
  return Array.from(mappedPackages.keys()).sort((a, b) => {
    const aLength = a.split('/node_modules/').length;
    const bLength = b.split('/node_modules/').length;
    if (aLength > bLength) {
      return 1;
    }
    if (aLength < bLength) {
      return -1;
    }
    return a.localeCompare(b);
  });
}

function elevateNestedPaths(
  remappedPackages: Map<string, MappedPackage>
): MappedPackage[] {
  const result = new Map<string, MappedPackage>();
  const sortedPaths = sortMappedPackagesPaths(remappedPackages);

  sortedPaths.forEach((path) => {
    const segments = path.split('/node_modules/');
    const mappedPackage = remappedPackages.get(path);

    // we keep hoisted packages intact
    if (segments.length === 1) {
      result.set(path, mappedPackage);
      return;
    }

    const packageName = segments.pop();
    const getNewPath = (segs) =>
      `${segs.join('/node_modules/')}/node_modules/${packageName}`;

    // check if grandparent has the same package
    const shouldElevate = (segs: string[]) => {
      const elevatedPath = getNewPath(segs.slice(0, -1));
      if (result.has(elevatedPath)) {
        const match = result.get(elevatedPath);
        return (
          match.valueV1?.version === mappedPackage.valueV1?.version &&
          match.valueV3?.version === mappedPackage.valueV3?.version
        );
      }
      return true;
    };

    while (segments.length > 1 && shouldElevate(segments)) {
      segments.pop();
    }
    const newPath = getNewPath(segments);
    if (path !== newPath) {
      if (!result.has(newPath)) {
        mappedPackage.path = newPath;
        result.set(newPath, mappedPackage);
      }
    } else {
      result.set(path, mappedPackage);
    }
  });

  return Array.from(result.values());
}

type V3Index = Map<string, NpmDependencyV3[]>;

// Bucket packages by their trailing "node_modules/<name>" segment so a lookup
// scans only that name's copies instead of every package (was O(nodes *
// allPackages)). Mirrors the old `key.endsWith(node_modules/<name>)` match:
// the name is whatever follows the last "node_modules/" in the key.
function buildV3Index(
  packages: Record<string, NpmDependencyV3> | undefined
): V3Index {
  const index: V3Index = new Map();
  if (!packages) return index;
  const marker = 'node_modules/';
  for (const key of Object.keys(packages)) {
    const snapshot = packages[key];
    // Bundled snapshots are not independently installable package candidates.
    if (snapshot.inBundle) continue;
    const i = key.lastIndexOf(marker);
    if (i === -1) continue; // root "" / workspace paths never matched endsWith
    const name = key.slice(i + marker.length);
    let bucket = index.get(name);
    if (!bucket) index.set(name, (bucket = []));
    bucket.push(snapshot);
  }
  return index;
}

function findMatchingPackageV3(
  packageIndex: V3Index,
  name: string,
  version: string
) {
  const bucket = packageIndex.get(name);
  if (!bucket) return undefined;
  for (const { dev, peer, ...snapshot } of bucket) {
    if (
      [
        snapshot.version,
        snapshot.resolved,
        `npm:${snapshot.name}@${snapshot.version}`,
      ].includes(version)
    ) {
      return snapshot;
    }
  }
}

function findMatchingPackageV1(
  packages: Record<string, NpmDependencyV1>,
  name: string,
  version: string
) {
  for (const [
    packageName,
    { dev, peer, dependencies, ...snapshot },
  ] of Object.entries(packages)) {
    if (packageName === name) {
      if (snapshot.version === version) {
        return snapshot;
      }
    }
    if (dependencies) {
      const found = findMatchingPackageV1(dependencies, name, version);
      if (found) {
        return found;
      }
    }
  }
}
