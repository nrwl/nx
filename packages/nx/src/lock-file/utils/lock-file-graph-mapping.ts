import { nodeKey } from './lock-file-builder';
import { LockFileEdge, LockFileGraph, LockFileNode } from './types';
import { ProjectGraph } from '../../config/project-graph';
import { ProjectGraphBuilder } from '../../project-graph/project-graph-builder';

export function mapLockFileGraphToProjectGraph(
  lockFileGraph: LockFileGraph
): ProjectGraph {
  const builder = new ProjectGraphBuilder();
  const nodeNames = new Map<LockFileNode, string>(); // path -> node name
  const edges = new Set<LockFileEdge>();

  // add nodes
  lockFileGraph.nodes.forEach((node) => {
    const nodeName = getExternalNodeName(node);
    nodeNames.set(node, nodeName);

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
    const sourceName = nodeNames.get(edge.from);
    const targetName = nodeNames.get(edge.to);
    builder.addExternalNodeDependency(sourceName, targetName);
  });

  return builder.getUpdatedProjectGraph();
}

export function getExternalNodeName(node: LockFileNode): `npm:${string}` {
  if (node.isHoisted) {
    return `npm:${node.name}`;
  }
  return `npm:${nodeKey(node)}`;
}
