import { defaultHashing } from '../../hasher/hashing-impl';
import {
  ProjectGraph,
  ProjectGraphExternalNode,
} from '../../config/project-graph';

/**
 * Apply simple hashing of the content using the default hashing implementation
 * @param fileContent
 * @returns
 */
export function hashString(fileContent: string): string {
  return defaultHashing.hashArray([fileContent]);
}

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
    try {
      const targetKey = `${target.data.packageName}@${target.data.version}`;
      if (visited.indexOf(targetKey) === -1) {
        visited.push(targetKey);
        if (graph.dependencies[d.target]) {
          traverseExternalNodesDependencies(d.target, graph, visited);
        }
      }
    } catch (e) {
      console.log(d.target, Object.keys(graph.externalNodes));
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
  packages: string[],
  projectName?: string
) {
  const hashingInput = [originalHash, ...packages];
  if (projectName) {
    hashingInput.push(projectName);
  }
  return defaultHashing.hashArray(hashingInput);
}
