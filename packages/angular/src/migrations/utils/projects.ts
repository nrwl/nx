import type { ProjectGraphProjectNode } from '@nx/devkit';
import { createProjectGraphAsync } from '@nx/devkit';

export async function getProjectsFilteredByDependencies(
  dependencies: string[]
): Promise<ProjectGraphProjectNode[]> {
  const projectGraph = await createProjectGraphAsync();

  return Object.entries(projectGraph.dependencies)
    .filter(
      ([node, deps]) =>
        !projectGraph.externalNodes?.[node] &&
        deps.some(({ target }) => dependencies.includes(target))
    )
    .map(([projectName]) => projectGraph.nodes[projectName]);
}
