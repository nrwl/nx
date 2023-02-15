import { ProjectGraph } from '../../../config/project-graph';
import { ProjectGraphBuilder } from '../../../project-graph/project-graph-builder';

export function removeNpmNodes(
  graph: ProjectGraph,
  builder: ProjectGraphBuilder
) {
  for (const externalNode in graph.externalNodes) {
    builder.removeNode(externalNode);
  }
}
