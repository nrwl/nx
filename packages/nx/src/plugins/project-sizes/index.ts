import {
  CreateMetadata,
  CreateMetadataContext,
  ProjectsMetadata,
} from '../../project-graph/plugins';
import { ProjectGraph } from '../../config/project-graph';
import { getFileMap } from '../../project-graph/build-project-graph';

export const name = 'nx/core/project-sizes';

export const createMetadata: CreateMetadata = (
  graph: ProjectGraph,
  options: unknown,
  context: CreateMetadataContext
): ProjectsMetadata => {
  // TODO: should this be a call to the daemon so that we can work in isolated context?
  const {
    fileMap: { projectFileMap },
  } = getFileMap();

  const projectsMetadata: ProjectsMetadata = {};
  for (const [projectId, project] of Object.entries(graph.nodes)) {
    let totalSize = 0;
    let totalFiles = projectFileMap[projectId].length;
    for (let i of projectFileMap[projectId]) {
      totalSize += i.size ?? 0;
    }

    projectsMetadata[projectId] = {
      metadata: {
        totalSize,
        totalFiles,
      } as any,
    };
  }

  return projectsMetadata;
};
