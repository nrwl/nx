import { ProjectGraphProcessor } from '../../config/project-graph';
import { ProjectGraphBuilder } from '../../project-graph/project-graph-builder';
import { buildNpmPackageNodes } from './project-graph/build-nodes/build-npm-package-nodes';

export const processProjectGraph: ProjectGraphProcessor = (graph) => {
  const builder = new ProjectGraphBuilder(graph);

  buildNpmPackageNodes(builder);

  return builder.getUpdatedProjectGraph();
};
