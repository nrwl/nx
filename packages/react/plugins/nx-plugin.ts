import { CreateMetadata, ProjectsMetadata } from '@nx/devkit';

export const createMetadata: CreateMetadata = (graph) => {
  const metadata: ProjectsMetadata = {};

  function isReactProject(projectName: string) {
    return graph.dependencies[projectName].some((dep) =>
      dep.target.startsWith('npm:react')
    );
  }

  for (const projectName in graph.nodes) {
    if (isReactProject(projectName)) {
      metadata[projectName] = {
        metadata: {
          technologies: ['react'],
        },
      };
    }
  }

  return metadata;
};
