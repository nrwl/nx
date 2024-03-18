import {
  createProjectGraphAsync,
  joinPathFragments,
  offsetFromRoot,
  workspaceRoot,
  type ProjectGraph,
  type ProjectGraphProjectNode,
} from '@nx/devkit';
import {
  createProjectRootMappings,
  findProjectForPath,
} from 'nx/src/project-graph/utils/find-project-for-path';
import { findAllProjectNodeDependencies } from 'nx/src/utils/project-graph-utils';
import { normalize, relative, sep } from 'path';

/**
 * Generates an array of paths to watch based on the project dependencies.
 *
 * @param {string} dirname The absolute path to the Remix project, typically `__dirname`.
 */
export async function createWatchPaths(dirname: string): Promise<string[]> {
  const graph = await createProjectGraphAsync();
  const projectRootMappings = createProjectRootMappings(graph.nodes);
  const projectName = findProjectForPath(
    relative(workspaceRoot, dirname),
    projectRootMappings
  );
  const deps = findAllProjectNodeDependencies(projectName, graph);

  return getRelativeDependencyPaths(graph.nodes[projectName], deps, graph);
}

// Exported for testing
export function getRelativeDependencyPaths(
  project: ProjectGraphProjectNode,
  deps: string[],
  graph: ProjectGraph
): string[] {
  if (!project.data?.root) {
    throw new Error(
      `Project ${project.name} has no root set. Check the project configuration.`
    );
  }

  const paths = new Set<string>();
  const offset = offsetFromRoot(project.data.root);
  const [baseProjectPath] = project.data.root.split('/');

  for (const dep of deps) {
    const node = graph.nodes[dep];
    if (!node?.data?.root) continue;
    const [basePath] = normalize(node.data.root).split(sep);
    const watchPath = baseProjectPath !== basePath ? basePath : node.data.root;
    const relativeWatchPath = joinPathFragments(offset, watchPath);
    paths.add(relativeWatchPath);
  }

  return Array.from(paths);
}
