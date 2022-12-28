import { LockFileEdge, LockFileGraph, LockFileNode } from './lock-file-builder';
import { ProjectGraph } from '../../config/project-graph';
import { ProjectGraphBuilder } from '../../project-graph/project-graph-builder';

export function mapLockFileGraphToProjectGraph(
  lockFileGraph: LockFileGraph
): ProjectGraph {
  const builder = new ProjectGraphBuilder();
  const nodeNames = new Map<string, string>(); // path -> node name
  const edges = new Set<LockFileEdge>();

  // add nodes
  lockFileGraph.nodes.forEach((node) => {
    if (node.isProjectRoot) {
      return;
    }
    const nodeName = getExternalNodeName(node);
    nodeNames.set(node.path, nodeName);

    builder.addExternalNode({
      type: 'npm',
      name: nodeName,
      data: {
        version: node.version,
        packageName: node.packageName || node.name,
      },
    });

    // collect edges for dependencies
    // we need to add them after all nodes are added
    // to avoid graph errors
    node.edgesOut.forEach((edge) => {
      edges.add(edge);
    });
  });

  // add dependencies
  edges.forEach((edge) => {
    const sourceName = nodeNames.get(edge.from.path);
    const targetName = nodeNames.get(edge.to.path);
    builder.addExternalNodeDependency(sourceName, targetName);
  });

  return builder.getUpdatedProjectGraph();
}

function getExternalNodeName(node: LockFileNode): `npm:${string}` {
  const rootVersion = node.path === `node_modules/${node.name}`;

  if (rootVersion) {
    return `npm:${node.name}`;
  }
  if (node.packageName) {
    return `npm:${node.name}@npm:${node.packageName}@${node.version}`;
  }

  return `npm:${node.name}@${node.version}`;
}
