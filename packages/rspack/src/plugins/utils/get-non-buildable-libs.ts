import { type ProjectGraph } from '@nx/devkit';
import { getAllTransitiveDeps } from './get-transitive-deps';
import { isBuildableLibrary } from './is-lib-buildable';

/**
 * Get all non-buildable libraries in the project graph for a given project.
 * This function retrieves all direct and transitive dependencies of a project,
 * filtering out only those that are libraries and not buildable.
 * @param graph Project graph
 * @param projectName The project name to get dependencies for
 * @returns A list of all non-buildable libraries that the project depends on, including transitive dependencies.
 */

export function getNonBuildableLibs(
  graph: ProjectGraph,
  projectName: string
): string[] {
  const deps = graph?.dependencies?.[projectName] ?? [];

  const allNonBuildable = new Set<string>();

  // First, find all direct non-buildable deps and add them App -> library
  const directNonBuildable = deps.filter((dep) => {
    const node = graph.nodes?.[dep.target];
    if (!node || node.type !== 'lib') return false;
    const hasBuildTarget = 'build' in (node.data?.targets ?? {});
    if (hasBuildTarget) return false;
    return !isBuildableLibrary(node);
  });

  // Add direct non-buildable dependencies
  for (const dep of directNonBuildable) {
    const packageName =
      graph.nodes?.[dep.target]?.data?.metadata?.js?.packageName;
    if (packageName) {
      allNonBuildable.add(packageName);
    }

    // Get all transitive non-buildable dependencies App -> library1 -> library2
    const transitiveDeps = getAllTransitiveDeps(graph, dep.target);
    transitiveDeps.forEach((pkg) => allNonBuildable.add(pkg));
  }

  return Array.from(allNonBuildable);
}
