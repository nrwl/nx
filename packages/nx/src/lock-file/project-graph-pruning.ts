import { ProjectGraphBuilder } from '../project-graph/project-graph-builder';
import {
  ProjectGraph,
  ProjectGraphExternalNode,
} from '../config/project-graph';
import { PackageJson } from '../utils/package-json';
import { reverse } from '../project-graph/operators';

export function pruneProjectGraph(
  graph: ProjectGraph,
  prunedPackageJson: PackageJson
): ProjectGraph {
  const builder = new ProjectGraphBuilder();

  // TODO: 0. normalize packageJson to ensure correct version (replace version e.g. ^1.0.0 with matching 1.2.3) (happens only with manually modified package.json)

  const {
    dependencies,
    devDependencies,
    optionalDependencies,
    peerDependencies,
  } = prunedPackageJson;

  const combinedDependencies = {
    ...dependencies,
    ...devDependencies,
    ...optionalDependencies,
    ...peerDependencies,
  };

  addNodesAndDependencies(graph, combinedDependencies, builder);
  rehoistNodes(graph, combinedDependencies, builder);

  return builder.getUpdatedProjectGraph();
}

function addNodesAndDependencies(
  graph: ProjectGraph,
  dependencies: Record<string, string>,
  builder: ProjectGraphBuilder
) {
  Object.entries(dependencies).forEach(([name, version]) => {
    const node =
      graph.externalNodes[`npm:${name}@${version}`] ||
      graph.externalNodes[`npm:${name}`];
    if (!node) {
      throw new Error(
        `Pruning failed. The following package was not found in root lock file: ${name}@${version}`
      );
    }
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
    builder.addExternalNodeDependency(node.name, dep.target);
  });
}

function rehoistNodes(
  graph: ProjectGraph,
  dependencies: Record<string, string>,
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

  // find new hoisted version
  packagesToRehoist.forEach((nestedNodes) => {
    if (nestedNodes.length === 1) {
      switchNodeToHoisted(nestedNodes[0], builder);
    } else {
      // invert dependencies for easier traversal back
      const invertedGraph = reverse(builder.graph);
      let minDistance = Infinity;
      let closest;
      nestedNodes.forEach((node) => {
        const distance = pathLengthToIncoming(
          node,
          dependencies,
          builder,
          invertedGraph
        );
        if (distance < minDistance) {
          minDistance = distance;
          closest = node;
        }
      });
      switchNodeToHoisted(closest, builder);
    }
  });
}

function switchNodeToHoisted(
  node: ProjectGraphExternalNode,
  builder: ProjectGraphBuilder
) {
  const previousName = node.name;
  const targets = (builder.graph.dependencies[node.name] || []).map(
    (d) => d.target
  );
  const sources: string[] = Object.keys(builder.graph.dependencies).filter(
    (name) =>
      builder.graph.dependencies[name].some((d) => d.target === previousName)
  );

  builder.removeNode(node.name);

  node.name = `npm:${node.data.packageName}`;
  builder.addExternalNode(node);

  for (const target of targets) {
    builder.addExternalNodeDependency(node.name, target);
  }
  sources.forEach((source) =>
    builder.addExternalNodeDependency(source, node.name)
  );
}

function pathLengthToIncoming(
  node: ProjectGraphExternalNode,
  dependencies: Record<string, string>,
  builder: ProjectGraphBuilder,
  invertedGraph: ProjectGraph
): number {
  const visited = new Set<string>([node.name]);
  const queue: Array<[ProjectGraphExternalNode, number]> = [[node, 0]];

  while (queue.length > 0) {
    const [current, distance] = queue.shift();

    if (dependencies[current.data.packageName] === current.data.version) {
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
