import type { ProjectGraph, ProjectGraphProjectNode } from '@nx/devkit';

function isSourceFile(path: string): boolean {
  return ['.ts', '.tsx', '.mts', '.cts'].some((ext) => path.endsWith(ext));
}

function isBuildableExportMap(packageExports: any): boolean {
  if (!packageExports || Object.keys(packageExports).length === 0) {
    return false; // exports = {} → not buildable
  }

  const isCompiledExport = (value: unknown): boolean => {
    if (typeof value === 'string') {
      return !isSourceFile(value);
    }
    if (typeof value === 'object' && value !== null) {
      return Object.entries(value).some(([key, subValue]) => {
        if (
          key === 'types' ||
          key === 'development' ||
          key === './package.json'
        )
          return false;
        return typeof subValue === 'string' && !isSourceFile(subValue);
      });
    }
    return false;
  };

  if (packageExports['.']) {
    return isCompiledExport(packageExports['.']);
  }

  return Object.entries(packageExports).some(
    ([key, value]) => key !== '.' && isCompiledExport(value)
  );
}

/**
 * Check if the library is buildable.
 * @param node from the project graph
 * @returns boolean
 */
export function isBuildableLibrary(node: ProjectGraphProjectNode): boolean {
  if (!node.data.metadata?.js) {
    return false;
  }
  const { packageExports, packageMain } = node.data.metadata.js;
  // if we have exports only check this else fallback to packageMain
  if (packageExports) {
    return isBuildableExportMap(packageExports);
  }
  return (
    typeof packageMain === 'string' &&
    packageMain !== '' &&
    !isSourceFile(packageMain)
  );
}
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
