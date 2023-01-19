import { ProjectGraphExternalNode } from '../../config/project-graph';
import { ProjectGraphBuilder } from '../../project-graph/project-graph-builder';

export function matchExistingNode(
  builder: ProjectGraphBuilder,
  packageName: string,
  version: string
): ProjectGraphExternalNode {
  let existingNode = builder.graph.externalNodes[`npm:${packageName}`];
  if (existingNode && existingNode.data.version === version) {
    return existingNode;
  }
  existingNode = builder.graph.externalNodes[`npm:${packageName}@${version}`];
  if (existingNode && existingNode.data.version === version) {
    return existingNode;
  }
}

export function switchNodeToNested(
  node: ProjectGraphExternalNode,
  builder: ProjectGraphBuilder
) {
  delete builder.graph.externalNodes[node.name];

  node.name = `npm:${node.data.packageName}@${node.data.version}`;
  builder.addExternalNode(node);
}
