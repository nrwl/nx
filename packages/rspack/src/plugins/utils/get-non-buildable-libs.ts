import { type ProjectGraph, readJsonFile } from '@nx/devkit';
import { join } from 'path';
import { getAllTransitiveDeps } from './get-transitive-deps';
import { isBuildableLibrary } from './is-lib-buildable';

function escapePackageName(packageName: string): string {
  return packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeRegexAndConvertWildcard(pattern: string): string {
  return pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*');
}

function resolveConditionalExport(target: any): string | null {
  if (typeof target === 'string') {
    return target;
  }

  if (typeof target === 'object' && target !== null) {
    // Priority order for conditions
    const conditions = ['development', 'import', 'require', 'default'];
    for (const condition of conditions) {
      if (target[condition] && typeof target[condition] === 'string') {
        return target[condition];
      }
    }
  }

  return null;
}

export function createAllowlistFromExports(
  packageName: string,
  exports: Record<string, any> | string | undefined
): (string | RegExp)[] {
  if (!exports) {
    return [packageName];
  }

  const allowlist: (string | RegExp)[] = [];
  allowlist.push(packageName);

  if (typeof exports === 'string') {
    return allowlist;
  }

  if (typeof exports === 'object') {
    for (const [exportPath, target] of Object.entries(exports)) {
      if (typeof exportPath !== 'string') continue;

      const resolvedTarget = resolveConditionalExport(target);
      if (!resolvedTarget) continue;

      if (exportPath === '.') {
        continue;
      } else if (exportPath.startsWith('./')) {
        const subpath = exportPath.slice(2);

        if (subpath.includes('*')) {
          const regexPattern = escapeRegexAndConvertWildcard(subpath);
          allowlist.push(
            new RegExp(`^${escapePackageName(packageName)}/${regexPattern}$`)
          );
        } else {
          allowlist.push(`${packageName}/${subpath}`);
        }
      }
    }
  }

  return allowlist;
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
): (string | RegExp)[] {
  const deps = graph?.dependencies?.[projectName] ?? [];

  const allNonBuildable = new Set<string | RegExp>();

  // First, find all direct non-buildable deps and add them App -> library
  const directNonBuildable = deps.filter((dep) => {
    const node = graph.nodes?.[dep.target];
    if (!node || node.type !== 'lib') return false;
    const hasBuildTarget = 'build' in (node.data?.targets ?? {});
    if (hasBuildTarget) return false;
    return !isBuildableLibrary(node);
  });

  // Add direct non-buildable dependencies with expanded export patterns
  for (const dep of directNonBuildable) {
    const node = graph.nodes?.[dep.target];
    const packageName = node?.data?.metadata?.js?.packageName;

    if (packageName) {
      // Get exports from project metadata first (most reliable)
      const packageExports = node?.data?.metadata?.js?.packageExports;

      if (packageExports) {
        // Use metadata exports if available
        const allowlistPatterns = createAllowlistFromExports(
          packageName,
          packageExports
        );
        allowlistPatterns.forEach((pattern) => allNonBuildable.add(pattern));
      } else {
        // Fallback: try to read package.json directly
        try {
          const projectRoot = node.data.root;
          const packageJsonPath = join(projectRoot, 'package.json');
          const packageJson = readJsonFile(packageJsonPath);
          const allowlistPatterns = createAllowlistFromExports(
            packageName,
            packageJson.exports
          );
          allowlistPatterns.forEach((pattern) => allNonBuildable.add(pattern));
        } catch (error) {
          // Final fallback: just add base package name
          allNonBuildable.add(packageName);
        }
      }
    }

    // Get all transitive non-buildable dependencies App -> library1 -> library2
    const transitiveDeps = getAllTransitiveDeps(graph, dep.target);
    transitiveDeps.forEach((pkg) => allNonBuildable.add(pkg));
  }

  return Array.from(allNonBuildable);
}
