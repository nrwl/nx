import { type ProjectGraph } from '@nx/devkit';
import { isBuildableLibrary } from './is-lib-buildable';

/**
 * Get all transitive dependencies of a target that are non-buildable libraries.
 * This function traverses the project graph to find all dependencies of a given target,
 * @param graph Graph of the project
 * @param targetName The project name to get dependencies for
 * @param visited Set to keep track of visited nodes to prevent infinite loops in circular dependencies
 * @returns string[] - List of all transitive dependencies that are non-buildable libraries
 */
export function getAllTransitiveDeps(
  graph: ProjectGraph,
  targetName: string,
  visited = new Set<string>()
): string[] {
  if (visited.has(targetName)) {
    return [];
  }

  visited.add(targetName);

  const node = graph.nodes?.[targetName];
  if (!node) {
    return [];
  }

  // Get direct dependencies of this target
  const directDeps = graph.dependencies?.[targetName] || [];
  const transitiveDeps: string[] = [];

  for (const dep of directDeps) {
    const depNode = graph.nodes?.[dep.target];

    // Only consider library dependencies
    if (!depNode || depNode.type !== 'lib') {
      continue;
    }

    // Check if this dependency is non-buildable
    const hasBuildTarget = 'build' in (depNode.data?.targets ?? {});
    const isBuildable = hasBuildTarget || isBuildableLibrary(depNode);

    if (!isBuildable) {
      const packageName = depNode.data?.metadata?.js?.packageName;
      if (packageName) {
        transitiveDeps.push(packageName);
      }

      const nestedDeps = getAllTransitiveDeps(graph, dep.target, visited);
      transitiveDeps.push(...nestedDeps);
    }
  }

  return transitiveDeps;
}
