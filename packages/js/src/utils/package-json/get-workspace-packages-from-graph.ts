import { type ProjectGraph, ProjectGraphProjectNode } from '@nx/devkit';

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
