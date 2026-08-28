import { gte, satisfies } from 'semver';
import {
  ProjectGraph,
  ProjectGraphExternalNode,
  ProjectGraphProjectNode,
} from '../../../config/project-graph';
import { reverse } from '../../../project-graph/operators';
import { ProjectGraphBuilder } from '../../../project-graph/project-graph-builder';
import { getCatalogManager } from '../../../utils/catalog';
import { PackageJson } from '../../../utils/package-json';
import { PackageManager } from '../../../utils/package-manager';
import { workspaceRoot } from '../../../utils/workspace-root';
import { getWorkspacePackagesFromGraph } from '../utils/get-workspace-packages-from-graph';
import {
  normalizeLocalPathSpec,
  uncontainLocalPathSpec,
} from './pruned-output';

/**
 * Prune project graph's external nodes and their dependencies
 * based on the pruned package.json
 */
export function pruneProjectGraph(
  graph: ProjectGraph,
  prunedPackageJson: PackageJson,
  workspaceRootPath: string = workspaceRoot,
  packageManager?: PackageManager
): ProjectGraph {
  const builder = new ProjectGraphBuilder();
  const workspacePackages = getWorkspacePackagesFromGraph(graph);
  const { combinedDependencies, localPathNodes } = normalizeDependencies(
    prunedPackageJson,
    graph,
    workspacePackages,
    workspaceRootPath,
    packageManager
  );

  addNodesAndDependencies(
    graph,
    combinedDependencies,
    workspacePackages,
    builder
  );
  // A local-path dependency is keyed in the lockfile by the target's real
  // package name, which an aliased one does not share with its manifest entry,
  // so the name-based lookup above cannot reach its node. Add the nodes matched
  // by target path rather than repeating that match here.
  for (const node of localPathNodes) {
    traverseNode(graph, builder, node);
  }

  for (const project of workspacePackages.values()) {
    const node = graph.nodes[project.name];
    builder.addNode(node);
  }

  // for NPM (as well as the graph consistency)
  // we need to distinguish between hoisted and non-hoisted dependencies
  rehoistNodes(graph, combinedDependencies, builder);

  return builder.getUpdatedProjectGraph();
}

// ensure that dependency ranges from package.json (e.g. ^1.0.0)
// are replaced with the actual version based on the available nodes (e.g. 1.0.1)
// Also returns the external nodes matched for local-path dependencies, whose
// names the caller cannot re-derive from the returned map.
function normalizeDependencies(
  packageJson: PackageJson,
  graph: ProjectGraph,
  workspacePackages: Map<string, ProjectGraphProjectNode>,
  workspaceRootPath: string,
  packageManager?: PackageManager
): {
  combinedDependencies: Record<string, string>;
  localPathNodes: ProjectGraphExternalNode[];
} {
  const {
    dependencies,
    devDependencies,
    optionalDependencies,
    peerDependencies,
  } = packageJson;

  const combinedDependencies = {
    ...dependencies,
    ...devDependencies,
    ...optionalDependencies,
    ...peerDependencies,
  };
  const localPathNodes: ProjectGraphExternalNode[] = [];

  const manager = getCatalogManager(workspaceRootPath);
  Object.entries(combinedDependencies).forEach(
    ([packageName, versionRange]) => {
      let resolvedVersionRange = versionRange;
      if (manager?.isCatalogReference(versionRange)) {
        resolvedVersionRange = manager.resolveCatalogReference(
          workspaceRootPath,
          packageName,
          versionRange
        );
        if (!resolvedVersionRange) {
          throw new Error(
            `Could not resolve catalog reference for ${packageName}@${versionRange}.`
          );
        }
      }

      if (graph.externalNodes[`npm:${packageName}@${resolvedVersionRange}`]) {
        combinedDependencies[packageName] = resolvedVersionRange;
        return;
      }
      if (
        graph.externalNodes[`npm:${packageName}`] &&
        graph.externalNodes[`npm:${packageName}`].data.version ===
          resolvedVersionRange
      ) {
        combinedDependencies[packageName] = resolvedVersionRange;
        return;
      }
      // otherwise we need to find the correct version
      const node = findNodeMatchingVersion(
        graph,
        packageName,
        resolvedVersionRange
      );
      // A file:/link: local-path dependency (e.g. a vendored tarball) records a
      // path where a version would go, so the version-based lookups above never
      // match it; findLocalPathNode matches it on that path instead (pnpm-only,
      // matching the rest of the local-path handling).
      const localPathNode =
        !node &&
        packageManager === 'pnpm' &&
        !workspacePackages.has(packageName) &&
        isLocalPathSpecifier(resolvedVersionRange)
          ? findLocalPathNode(graph, packageName, resolvedVersionRange)
          : undefined;
      if (node) {
        combinedDependencies[packageName] = node.data.version;
      } else if (workspacePackages.has(packageName)) {
        // workspace module, leave as is
        combinedDependencies[packageName] = resolvedVersionRange;
      } else if (localPathNode) {
        combinedDependencies[packageName] = localPathNode.data.version;
        localPathNodes.push(localPathNode);
      } else if (
        packageManager === 'pnpm' &&
        resolvedVersionRange.startsWith('link:')
      ) {
        // Only a link: is valid importer-only in a pnpm lockfile (see
        // mapRootSnapshot); a nodeless file: (stale lockfile) or npm/yarn still throw.
        combinedDependencies[packageName] = resolvedVersionRange;
      } else {
        throw new Error(
          `Pruned lock file creation failed. The following package was not found in the root lock file: ${packageName}@${resolvedVersionRange}`
        );
      }
    }
  );
  return { combinedDependencies, localPathNodes };
}

/**
 * A `file:` (local tarball or directory) or `link:` specifier resolves to a
 * single local package. pnpm records its path relative to the workspace root in
 * the lockfile, while the manifest records it relative to the declaring package,
 * so the two never match by string.
 */
export function isLocalPathSpecifier(versionExpr: string): boolean {
  return versionExpr.startsWith('file:') || versionExpr.startsWith('link:');
}

/**
 * The external node for a `file:`/`link:` local-path dependency.
 *
 * The target path is what identifies one: an aliased dependency (`"alias":
 * "file:libs/x"`) is keyed in the lockfile by the target's real package name, so
 * the manifest's own name matches nothing. A manifest the pruned output already
 * rewrote carries a workspace-root-relative path, relocated under the shipped
 * output directory, which strips back to the path the lockfile records.
 *
 * A manifest that was not rewritten records the path relative to the declaring
 * package instead, and this has no way to resolve that against the workspace
 * root, so it falls back to the package name. Two local-path packages sharing a
 * name cannot be told apart by it, so that throws rather than risking a match to
 * the wrong one.
 */
export function findLocalPathNode(
  graph: ProjectGraph,
  packageName: string,
  versionExpr: string
): ProjectGraphExternalNode | undefined {
  const localPathNodes = Object.values(graph.externalNodes).filter((node) =>
    isLocalPathSpecifier(node.data.version)
  );
  // Only the manifest side is read back from its shipped location; the lock
  // file records the source path, which relocation never touched.
  const sourceSpec = uncontainLocalPathSpec(versionExpr);
  const targetMatch = localPathNodes.find(
    (node) => normalizeLocalPathSpec(node.data.version) === sourceSpec
  );
  if (targetMatch) {
    return targetMatch;
  }
  const matches = localPathNodes.filter(
    (node) => node.data.packageName === packageName
  );
  if (matches.length > 1) {
    throw new Error(
      `Pruned lock file creation failed. Multiple local-path packages named "${packageName}" were found in the lock file (${matches
        .map((node) => node.data.version)
        .join(
          ', '
        )}), so the manifest's "${packageName}" dependency cannot be matched to one of them. Rename the packages so their names are unique.`
    );
  }
  return matches[0];
}

export function findNodeMatchingVersion(
  graph: ProjectGraph,
  packageName: string,
  versionExpr: string
) {
  if (versionExpr === '*') {
    return graph.externalNodes[`npm:${packageName}`];
  }
  const nodes = Object.values(graph.externalNodes)
    .filter((n) => n.data.packageName === packageName)
    .sort((a, b) => (gte(b.data.version, a.data.version) ? 1 : -1));

  if (versionExpr === 'latest') {
    return nodes.sort((a, b) => +gte(b.data.version, a.data.version))[0];
  }
  if (
    graph.externalNodes[`npm:${packageName}`] &&
    satisfies(
      graph.externalNodes[`npm:${packageName}`].data.version,
      versionExpr
    )
  ) {
    return graph.externalNodes[`npm:${packageName}`];
  }
  return nodes.find((n) => satisfies(n.data.version, versionExpr));
}

export function addNodesAndDependencies(
  graph: ProjectGraph,
  packageJsonDeps: Record<string, string>,
  workspacePackages: Map<string, ProjectGraphProjectNode>,
  builder: ProjectGraphBuilder
) {
  Object.entries(packageJsonDeps).forEach(([name, version]) => {
    const node =
      graph.externalNodes[`npm:${name}@${version}`] ||
      graph.externalNodes[`npm:${name}`];
    if (node) {
      traverseNode(graph, builder, node);
    } else if (workspacePackages.has(name)) {
      // Workspace Node
      const workspaceNode = workspacePackages.get(name);
      if (workspaceNode) {
        traverseWorkspaceNode(graph, builder, workspaceNode);
      }
    }
  });
}

function traverseNode(
  graph: ProjectGraph,
  builder: ProjectGraphBuilder,
  node: ProjectGraphExternalNode
) {
  if (builder.graph.externalNodes[node.name]) {
    return;
  }
  builder.addExternalNode(node);
  graph.dependencies[node.name]?.forEach((dep) => {
    const depNode = graph.externalNodes[dep.target];
    traverseNode(graph, builder, depNode);
    builder.addStaticDependency(node.name, dep.target);
  });
}

function traverseWorkspaceNode(
  graph: ProjectGraph,
  builder: ProjectGraphBuilder,
  node: ProjectGraphProjectNode,
  visited: Set<string> = new Set()
) {
  if (visited.has(node.name)) return;
  visited.add(node.name);
  graph.dependencies[node.name]?.forEach((dep) => {
    const externalDepNode = graph.externalNodes[dep.target];
    if (externalDepNode) {
      traverseNode(graph, builder, externalDepNode);
      return;
    }
    const workspaceDepNode = graph.nodes[dep.target];
    if (workspaceDepNode) {
      traverseWorkspaceNode(graph, builder, workspaceDepNode, visited);
    }
  });
}

export function rehoistNodes(
  graph: ProjectGraph,
  packageJsonDeps: Record<string, string>,
  builder: ProjectGraphBuilder
) {
  const packagesToRehoist = new Map<string, ProjectGraphExternalNode[]>();

  // find all packages that need to be rehoisted
  Object.values(graph.externalNodes).forEach((node) => {
    if (
      node.name === `npm:${node.data.packageName}` &&
      !builder.graph.externalNodes[node.name]
    ) {
      const nestedNodes = Object.values(builder.graph.externalNodes).filter(
        (n) => n.data.packageName === node.data.packageName
      );
      if (nestedNodes.length > 0) {
        packagesToRehoist.set(node.data.packageName, nestedNodes);
      }
    }
  });

  if (!packagesToRehoist.size) {
    return;
  }

  // invert dependencies for easier traversal back
  const invertedGraph = reverse(builder.graph);
  const invBuilder = new ProjectGraphBuilder(invertedGraph, {});

  // find new hoisted version
  packagesToRehoist.forEach((nestedNodes) => {
    if (nestedNodes.length === 1) {
      switchNodeToHoisted(nestedNodes[0], builder, invBuilder);
    } else {
      let minDistance = Infinity;
      let closest;
      nestedNodes.forEach((node) => {
        const distance = pathLengthToIncoming(
          node,
          packageJsonDeps,
          builder,
          invertedGraph
        );
        if (distance < minDistance) {
          minDistance = distance;
          closest = node;
        }
      });
      if (closest) {
        switchNodeToHoisted(closest, builder, invBuilder);
      }
    }
  });
}

function switchNodeToHoisted(
  node: ProjectGraphExternalNode,
  builder: ProjectGraphBuilder,
  invBuilder: ProjectGraphBuilder
) {
  // make a copy of current name, all the dependencies and dependents
  const previousName = node.name;
  const targets = (builder.graph.dependencies[node.name] || []).map(
    (d) => d.target
  );
  const sources: string[] = Object.keys(builder.graph.dependencies).filter(
    (name) =>
      builder.graph.dependencies[name].some((d) => d.target === previousName)
  );

  builder.removeNode(node.name);
  invBuilder.removeNode(node.name);

  // Re-add under the hoisted name as a new object. The node is shared by
  // reference with the caller's graph, so renaming it in place would leave that
  // graph with a node keyed `npm:<pkg>@<version>` but named `npm:<pkg>`, and
  // every later prune of the same graph would fail to resolve the edge.
  const hoistedNode: ProjectGraphExternalNode = {
    ...node,
    name: `npm:${node.data.packageName}`,
  };
  builder.addExternalNode(hoistedNode);
  invBuilder.addExternalNode(hoistedNode);

  targets.forEach((target) => {
    builder.addStaticDependency(hoistedNode.name, target);
    invBuilder.addStaticDependency(target, hoistedNode.name);
  });
  sources.forEach((source) => {
    builder.addStaticDependency(source, hoistedNode.name);
    invBuilder.addStaticDependency(hoistedNode.name, source);
  });
}

// BFS to find the shortest path to a dependency specified in package.json
// package version with the shortest path is the one that should be hoisted
function pathLengthToIncoming(
  node: ProjectGraphExternalNode,
  packageJsonDeps: Record<string, string>,
  builder: ProjectGraphBuilder,
  invertedGraph: ProjectGraph
): number {
  const visited = new Set<string>([node.name]);
  const queue: Array<[ProjectGraphExternalNode, number]> = [[node, 0]];

  while (queue.length > 0) {
    const [current, distance] = queue.shift();

    if (packageJsonDeps[current.data.packageName] === current.data.version) {
      return distance;
    }

    for (let { target } of invertedGraph.dependencies[current.name] || []) {
      if (!visited.has(target)) {
        visited.add(target);
        queue.push([builder.graph.externalNodes[target], distance + 1]);
      }
    }
  }
}
