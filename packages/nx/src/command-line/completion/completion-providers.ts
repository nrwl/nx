import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Lightweight cache reader that avoids importing heavy nx modules.
 * Reads project-graph.json directly from the workspace data directory.
 */
function getCachedProjectGraph(): any | null {
  try {
    const workspaceRoot = process.env.NX_WORKSPACE_ROOT_PATH || process.cwd();
    const dataDir =
      process.env.NX_WORKSPACE_DATA_DIRECTORY ??
      process.env.NX_PROJECT_GRAPH_CACHE_DIRECTORY ??
      join(workspaceRoot, '.nx', 'workspace-data');
    const graphPath = join(dataDir, 'project-graph.json');
    if (!existsSync(graphPath)) {
      return null;
    }
    return JSON.parse(readFileSync(graphPath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Returns project names matching the given prefix.
 */
export function getProjectNameCompletions(current: string): string[] {
  const graph = getCachedProjectGraph();
  if (!graph?.nodes) {
    return [];
  }
  const names = Object.keys(graph.nodes);
  if (!current) {
    return names;
  }
  return names.filter((name) => name.startsWith(current));
}

/**
 * Returns target names matching the given prefix.
 * If projectName is provided, only returns targets for that project.
 * Otherwise returns all unique target names across the workspace.
 */
export function getTargetNameCompletions(
  current: string,
  projectName?: string
): string[] {
  const graph = getCachedProjectGraph();
  if (!graph?.nodes) {
    return [];
  }

  let targets: string[];
  if (projectName && graph.nodes[projectName]) {
    targets = Object.keys(graph.nodes[projectName].data.targets ?? {});
  } else {
    const targetSet = new Set<string>();
    for (const node of Object.values(graph.nodes)) {
      for (const target of Object.keys((node as any).data.targets ?? {})) {
        targetSet.add(target);
      }
    }
    targets = Array.from(targetSet);
  }

  if (!current) {
    return targets;
  }
  return targets.filter((t) => t.startsWith(current));
}
