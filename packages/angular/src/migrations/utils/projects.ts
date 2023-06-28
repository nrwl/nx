import type {
  ProjectConfiguration,
  ProjectGraphProjectNode,
  Tree,
} from '@nx/devkit';
import { createProjectGraphAsync, readProjectConfiguration } from '@nx/devkit';

export async function getProjectsFilteredByDependencies(
  tree: Tree,
  dependencies: string[]
): Promise<
  Array<{
    project: ProjectConfiguration;
    graphNode: ProjectGraphProjectNode;
  }>
> {
  const projectGraph = await createProjectGraphAsync();

  return Object.entries(projectGraph.dependencies)
    .filter(
      ([node, deps]) =>
        !projectGraph.externalNodes?.[node] &&
        deps.some(({ target }) => dependencies.includes(target))
    )
    .map(([projectName]) => ({
      project: readProjectConfiguration(tree, projectName),
      graphNode: projectGraph.nodes[projectName],
    }));
}
