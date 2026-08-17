import {
  type ProjectGraph,
  ProjectGraphProjectNode,
} from '../../../config/project-graph';
import {
  matchDependencyToWorkspacePackage,
  parseDependencySpecifier,
} from './dependency-specifiers';

export function getWorkspacePackagesFromGraph(graph: ProjectGraph) {
  const workspacePackages: Map<string, ProjectGraphProjectNode> = new Map();
  for (const [projectName, project] of Object.entries(graph.nodes)) {
    const pkgName = project.data?.metadata?.js?.packageName;
    if (pkgName) {
      workspacePackages.set(pkgName, project);
    }
  }
  return workspacePackages;
}

/**
 * Returns the workspace package's version, `null` when the package exists
 * without a version, or `undefined` when no workspace package has that name.
 * Matches the `getPackageVersion` contract of
 * `matchDependencyToWorkspacePackage`.
 */
function getWorkspacePackageVersion(
  workspacePackages: Map<string, ProjectGraphProjectNode>,
  packageName: string
): string | null | undefined {
  const node = workspacePackages.get(packageName);
  if (!node) {
    return undefined;
  }
  return node.data.metadata?.js?.packageVersion ?? null;
}

/**
 * Resolves a package.json dependency entry to the workspace package it
 * references: the target of an aliasing `workspace:`/`npm:` specifier, or the
 * key itself when it names a workspace package. Returns null for entries that
 * do not reference a workspace package.
 */
export function resolveWorkspaceDependencyTarget(
  dependencyKey: string,
  specifier: string | undefined,
  workspacePackages: Map<string, ProjectGraphProjectNode>
): string | null {
  if (typeof specifier === 'string') {
    const parsed = parseDependencySpecifier(specifier);
    if (parsed.requestedPackageName !== null) {
      // aliasing specifier: the requested target decides, the key does not
      return (
        matchDependencyToWorkspacePackage(dependencyKey, specifier, (name) =>
          getWorkspacePackageVersion(workspacePackages, name)
        )?.requestedPackageName ?? null
      );
    }
  }
  return workspacePackages.has(dependencyKey) ? dependencyKey : null;
}
