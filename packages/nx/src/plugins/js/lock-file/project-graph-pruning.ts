import {
  ProjectGraph,
  ProjectGraphExternalNode,
} from '../../../config/project-graph';
import { satisfies, gte } from 'semver';
import { PackageJson } from '../../../utils/package-json';
import { ProjectGraphBuilder } from '../../../project-graph/project-graph-builder';
import { reverse } from '../../../project-graph/operators';

/**
 * Prune project graph's external nodes and their dependencies
 * based on the pruned package.json
 */
export function pruneProjectGraph(
  graph: ProjectGraph,
  prunedPackageJson: PackageJson
): ProjectGraph {
  const builder = new ProjectGraphBuilder();

  const combinedDependencies = normalizeDependencies(prunedPackageJson, graph);

  addNodesAndDependencies(graph, combinedDependencies, builder);
  // for NPM (as well as the graph consistency)
  // we need to distinguish between hoisted and non-hoisted dependencies
  rehoistNodes(graph, combinedDependencies, builder);

  return builder.getUpdatedProjectGraph();
}

// ensure that dependency ranges from package.json (e.g. ^1.0.0)
// are replaced with the actual version based on the available nodes (e.g. 1.0.1)
function normalizeDependencies(packageJson: PackageJson, graph: ProjectGraph) {
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

  Object.entries(combinedDependencies).forEach(
    ([packageName, versionRange]) => {
      if (graph.externalNodes[`npm:${packageName}@${versionRange}`]) {
        return;
      }
      if (
        graph.externalNodes[`npm:${packageName}`] &&
        graph.externalNodes[`npm:${packageName}`].data.version === versionRange
      ) {
        return;
      }
      // otherwise we need to find the correct version
      const node = findNodeMatchingVersion(graph, packageName, versionRange);
      if (node) {
        combinedDependencies[packageName] = node.data.version;
      } else {
        throw new Error(
          `Pruned lock file creation failed. The following package was not found in the root lock file: ${packageName}@${versionRange}`
        );
      }
    }
  );
  return combinedDependencies;
}

function findNodeMatchingVersion(
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

function addNodesAndDependencies(
  graph: ProjectGraph,
  packageJsonDeps: Record<string, string>,
  builder: ProjectGraphBuilder
) {
  Object.entries(packageJsonDeps).forEach(([name, version]) => {
    const node =
      graph.externalNodes[`npm:${name}@${version}`] ||
      graph.externalNodes[`npm:${name}`];
    traverseNode(graph, builder, node);
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

function rehoistNodes(
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
      switchNodeToHoisted(closest, builder, invBuilder);
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

  // modify the node and re-add it
  node.name = `npm:${node.data.packageName}`;
  builder.addExternalNode(node);
  invBuilder.addExternalNode(node);

  targets.forEach((target) => {
    builder.addStaticDependency(node.name, target);
    invBuilder.addStaticDependency(target, node.name);
  });
  sources.forEach((source) => {
    builder.addStaticDependency(source, node.name);
    invBuilder.addStaticDependency(node.name, source);
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
