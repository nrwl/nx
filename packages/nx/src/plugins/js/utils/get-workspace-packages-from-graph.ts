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
 * Resolves a dependency key and specifier to its workspace target package
 * name, or null. Alias targets override the key.
 */
export function resolveWorkspaceDependencyTarget(
  dependencyKey: string,
  specifier: string | undefined,
  workspacePackages: Map<string, ProjectGraphProjectNode>
): string | null {
  if (typeof specifier === 'string') {
    const parsed = parseDependencySpecifier(specifier);
    if (parsed.requestedPackageName !== null) {
      return (
        matchDependencyToWorkspacePackage(dependencyKey, specifier, (name) =>
          getWorkspacePackageVersion(workspacePackages, name)
        )?.requestedPackageName ?? null
      );
    }
  }
  return workspacePackages.has(dependencyKey) ? dependencyKey : null;
}
