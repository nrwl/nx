import { defaultHashing } from '../../hasher/hashing-impl';
import {
  ProjectGraph,
  ProjectGraphExternalNode,
} from '../../config/project-graph';
import { PackageJsonDeps } from './pruning';

/**
 * Apply simple hashing of the content using the default hashing implementation
 * @param fileContent
 * @returns
 */
export function hashString(fileContent: string): string {
  return defaultHashing.hashArray([fileContent]);
}

/**
 * Hash partial graph's external nodes
 * for task graph caching
 * @param projectGraph
 */
export function hashExternalNodes(projectGraph: ProjectGraph) {
  Object.keys(projectGraph.externalNodes).forEach((key) => {
    if (!projectGraph.externalNodes[key].data.hash) {
      // hash it using it's dependencies
      hashExternalNode(projectGraph.externalNodes[key], projectGraph);
    }
  });
}

function hashExternalNode(node: ProjectGraphExternalNode, graph: ProjectGraph) {
  const hashKey = `${node.data.packageName}@${node.data.version}`;

  if (!graph.dependencies[node.name]) {
    node.data.hash = hashString(hashKey);
  } else {
    const hashingInput = [hashKey];

    // collect all dependencies' hashes
    traverseExternalNodesDependencies(node.name, graph, hashingInput);
    node.data.hash = defaultHashing.hashArray(hashingInput.sort());
  }
}

function traverseExternalNodesDependencies(
  projectName: string,
  graph: ProjectGraph,
  visited: string[]
) {
  graph.dependencies[projectName].forEach((d) => {
    const target = graph.externalNodes[d.target];
    const targetKey = `${target.data.packageName}@${target.data.version}`;

    if (visited.indexOf(targetKey) === -1) {
      visited.push(targetKey);
      if (graph.dependencies[d.target]) {
        traverseExternalNodesDependencies(d.target, graph, visited);
      }
    }
  });
}

/**
 * Generate new hash based on the original hash and pruning input parameters - packages and project name
 * @param originalHash
 * @param packages
 * @param projectName
 * @returns
 */
export function generatePrunnedHash(
  originalHash: string,
  normalizedPackageJson: PackageJsonDeps
) {
  const hashingInput = [originalHash, JSON.stringify(normalizedPackageJson)];
  return defaultHashing.hashArray(hashingInput);
}
