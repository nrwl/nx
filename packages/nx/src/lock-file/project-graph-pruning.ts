import { ProjectGraphBuilder } from '../project-graph/project-graph-builder';
import {
  ProjectGraph,
  ProjectGraphExternalNode,
} from '../config/project-graph';
import { PackageJson } from '../utils/package-json';

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
      const invertedDependencies: Record<string, string[]> = {};
      Object.values(builder.graph.dependencies).forEach((deps) => {
        deps.forEach((dep) => {
          invertedDependencies[dep.target] =
            invertedDependencies[dep.target] || [];
          invertedDependencies[dep.target].push(dep.source);
        });
      });
      let minDistance = Infinity;
      let closest;
      nestedNodes.forEach((node) => {
        const distance = pathLengthToIncoming(
          node,
          dependencies,
          builder,
          invertedDependencies
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
  delete builder.graph.externalNodes[previousName];

  node.name = `npm:${node.data.packageName}`;
  builder.addExternalNode(node);

  // remap all from dependencies
  if (builder.graph.dependencies[previousName]) {
    builder.graph.dependencies[previousName].forEach((dep) => {
      builder.addExternalNodeDependency(node.name, dep.target);
    });
    delete builder.graph.dependencies[previousName];
  }
  // remap all to dependencies
  Object.values(builder.graph.dependencies).forEach((deps) => {
    deps.forEach((dep) => {
      if (dep.target === previousName) {
        dep.target = node.name;
      }
    });
  });
}

function pathLengthToIncoming(
  node: ProjectGraphExternalNode,
  dependencies: Record<string, string>,
  builder: ProjectGraphBuilder,
  invertedDependencies: Record<string, string[]>
): number {
  const visited = new Set<string>([node.name]);
  const queue: Array<[ProjectGraphExternalNode, number]> = [[node, 0]];

  while (queue.length > 0) {
    const [current, distance] = queue.shift();

    for (let parent of invertedDependencies[current.name] || []) {
      if (dependencies[current.data.packageName] === current.data.version) {
        return distance;
      }
      if (!visited.has(parent)) {
        visited.add(parent);
        queue.push([builder.graph.externalNodes[parent], distance + 1]);
      }
    }
  }
}
