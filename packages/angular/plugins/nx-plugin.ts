import { CreateMetadata, ProjectsMetadata } from '@nx/devkit';

export const createMetadata: CreateMetadata = (graph) => {
  const metadata: ProjectsMetadata = {};

  function isAngularProject(projectName: string) {
    return graph.dependencies[projectName].some((dep) =>
      dep.target.startsWith('npm:@angular')
    );
  }

  for (const projectName in graph.nodes) {
    if (isAngularProject(projectName)) {
      metadata[projectName] = {
        metadata: {
          technologies: ['angular'],
        },
      };
    }
  }

  return metadata;
};
