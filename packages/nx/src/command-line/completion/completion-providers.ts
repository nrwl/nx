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
 * Returns names of projects that have the given target, matching the prefix.
 * Used for infix completions like `nx build <TAB>` — we only want projects
 * that actually have a `build` target, not every project in the workspace.
 */
export function getProjectNamesWithTarget(
  current: string,
  targetName: string
): string[] {
  const graph = getCachedProjectGraph();
  if (!graph?.nodes) {
    return [];
  }
  const matches: string[] = [];
  for (const [name, node] of Object.entries<any>(graph.nodes)) {
    if (node?.data?.targets && targetName in node.data.targets) {
      if (!current || name.startsWith(current)) {
        matches.push(name);
      }
    }
  }
  return matches;
}

/**
 * Two-stage completion of a `project[:target]` token. First stage returns
 * project names with a trailing `:` so the shell suppresses the space and
 * the user can TAB again for targets within the chosen project.
 */
export function completeProjectTarget(current: string): string[] {
  const colonIdx = current.indexOf(':');
  if (colonIdx === -1) {
    return getProjectNameCompletions(current).map((p) => `${p}:`);
  }
  const projectName = current.slice(0, colonIdx);
  const targetPrefix = current.slice(colonIdx + 1);
  return getTargetNameCompletions(targetPrefix, projectName).map(
    (t) => `${projectName}:${t}`
  );
}

/**
 * Two-stage completion of a `<plugin>:<generator>` token, mirroring
 * project:target above.
 */
export function completeGenerator(current: string): string[] {
  const colonIdx = current.indexOf(':');
  if (colonIdx === -1) {
    return getGeneratorPluginCompletions(current).map((p) => `${p}:`);
  }
  const pluginName = current.slice(0, colonIdx);
  const generatorPrefix = current.slice(colonIdx + 1);
  return getGeneratorsForPlugin(pluginName, generatorPrefix).map(
    (g) => `${pluginName}:${g}`
  );
}

/**
 * Returns plugin package names (with at least one generator) matching the prefix.
 */
export function getGeneratorPluginCompletions(current: string): string[] {
  const workspaceRoot = process.env.NX_WORKSPACE_ROOT_PATH || process.cwd();
  const plugins = listPluginsWithGenerators(workspaceRoot);
  if (!current) {
    return plugins;
  }
  return plugins.filter((p) => p.startsWith(current));
}

/**
 * Returns generator names within a single plugin matching the prefix.
 */
export function getGeneratorsForPlugin(
  pluginName: string,
  current: string
): string[] {
  const workspaceRoot = process.env.NX_WORKSPACE_ROOT_PATH || process.cwd();
  const generators = readGeneratorsJson(workspaceRoot, pluginName);
  if (!current) {
    return generators;
  }
  return generators.filter((g) => g.startsWith(current));
}

function listPluginsWithGenerators(workspaceRoot: string): string[] {
  const pkgPath = join(workspaceRoot, 'package.json');
  if (!existsSync(pkgPath)) {
    return [];
  }
  let pkg: any;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  } catch {
    return [];
  }
  const deps = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  };
  const result: string[] = [];
  for (const dep of Object.keys(deps)) {
    if (readGeneratorsJson(workspaceRoot, dep).length > 0) {
      result.push(dep);
    }
  }
  return result;
}

function readGeneratorsJson(
  workspaceRoot: string,
  pluginName: string
): string[] {
  try {
    const depPkgPath = join(
      workspaceRoot,
      'node_modules',
      pluginName,
      'package.json'
    );
    if (!existsSync(depPkgPath)) {
      return [];
    }
    const depPkg = JSON.parse(readFileSync(depPkgPath, 'utf-8'));
    const field = depPkg.generators ?? depPkg.schematics;
    if (typeof field !== 'string') {
      return [];
    }
    const generatorsJsonPath = join(
      workspaceRoot,
      'node_modules',
      pluginName,
      field
    );
    if (!existsSync(generatorsJsonPath)) {
      return [];
    }
    const generatorsJson = JSON.parse(
      readFileSync(generatorsJsonPath, 'utf-8')
    );
    const collection =
      generatorsJson.generators ?? generatorsJson.schematics ?? {};
    return Object.keys(collection).filter((k) => !collection[k]?.hidden);
  } catch {
    return [];
  }
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
