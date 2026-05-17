import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';

/**
 * Resolve the workspace root for completion. Completion runs without the
 * normal workspace bootstrap (`bin/nx.ts` returns before `initLocal`), so
 * `NX_WORKSPACE_ROOT_PATH` is usually unset and `process.cwd()` is whatever
 * subdirectory the user pressed TAB in. Walk up from cwd to the nearest
 * `nx.json` so project/target/generator completion works everywhere in the
 * workspace, not only at the root.
 *
 * Exported only so it can be unit-tested.
 */
export function resolveWorkspaceRoot(): string {
  const fromEnv = process.env.NX_WORKSPACE_ROOT_PATH;
  if (fromEnv) {
    return fromEnv;
  }
  let dir = process.cwd();
  while (true) {
    if (existsSync(join(dir, 'nx.json'))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      // Reached the filesystem root without finding nx.json.
      return process.cwd();
    }
    dir = parent;
  }
}

/**
 * Lightweight cache reader that avoids importing heavy nx modules.
 * Reads project-graph.json directly from the workspace data directory.
 *
 * Intentionally tolerates a stale graph: completion runs on every TAB press
 * and must stay fast, so we never refresh the graph here. A just-added
 * project missing for one keystroke is an acceptable trade — do not "fix"
 * this by triggering a graph recompute.
 */
function getCachedProjectGraph(): any | null {
  try {
    const workspaceRoot = resolveWorkspaceRoot();
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
 * Returns plugin collection names (with at least one generator) matching
 * the prefix. Covers both installed npm plugins and workspace-local plugin
 * projects (e.g. a `libs/my-plugin` with its own `generators.json`).
 */
export function getGeneratorPluginCompletions(current: string): string[] {
  const dirs = collectPluginDirs();
  const result: string[] = [];
  for (const [name, dir] of dirs) {
    if (current && !name.startsWith(current)) continue;
    if (readGeneratorNames(dir).length > 0) {
      result.push(name);
    }
  }
  return result;
}

/**
 * Returns generator names within a single plugin matching the prefix.
 */
export function getGeneratorsForPlugin(
  pluginName: string,
  current: string
): string[] {
  const dir = collectPluginDirs().get(pluginName);
  if (!dir) {
    return [];
  }
  const generators = readGeneratorNames(dir);
  if (!current) {
    return generators;
  }
  return generators.filter((g) => g.startsWith(current));
}

/**
 * Builds a map of collection name → directory containing the plugin's
 * `package.json`. Two sources:
 *   - installed npm plugins — root `package.json` deps, resolved under
 *     `node_modules/<name>`
 *   - workspace-local plugin projects — any project in the cached graph
 *     whose `package.json` declares a `generators`/`schematics` collection
 *
 * A local definition wins over a same-named installed package (the local
 * one is what the user is developing).
 */
function collectPluginDirs(): Map<string, string> {
  const workspaceRoot = resolveWorkspaceRoot();
  const dirs = new Map<string, string>();

  const rootPkg = readJsonSafe(join(workspaceRoot, 'package.json'));
  if (rootPkg) {
    const deps = {
      ...(rootPkg.dependencies ?? {}),
      ...(rootPkg.devDependencies ?? {}),
    };
    for (const dep of Object.keys(deps)) {
      dirs.set(dep, join(workspaceRoot, 'node_modules', dep));
    }
  }

  const graph = getCachedProjectGraph();
  for (const node of Object.values(graph?.nodes ?? {})) {
    const root = (node as any)?.data?.root;
    if (typeof root !== 'string' || !root) continue;
    const projectDir = join(workspaceRoot, root);
    const pkg = readJsonSafe(join(projectDir, 'package.json'));
    const collectionField = pkg?.generators ?? pkg?.schematics;
    if (pkg?.name && typeof collectionField === 'string') {
      dirs.set(pkg.name, projectDir);
    }
  }

  return dirs;
}

/**
 * Reads the non-hidden generator names from the `generators`/`schematics`
 * JSON referenced by the plugin's `package.json` in `pluginDir`.
 */
function readGeneratorNames(pluginDir: string): string[] {
  const pkg = readJsonSafe(join(pluginDir, 'package.json'));
  const field = pkg?.generators ?? pkg?.schematics;
  if (typeof field !== 'string') {
    return [];
  }
  const generatorsJson = readJsonSafe(join(pluginDir, field));
  if (!generatorsJson) {
    return [];
  }
  const collection =
    generatorsJson.generators ?? generatorsJson.schematics ?? {};
  return Object.keys(collection).filter((k) => !collection[k]?.hidden);
}

function readJsonSafe(path: string): any | null {
  try {
    if (!existsSync(path)) {
      return null;
    }
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
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
    targets = Object.keys(graph.nodes[projectName]?.data?.targets ?? {});
  } else {
    const targetSet = new Set<string>();
    for (const node of Object.values(graph.nodes)) {
      for (const target of Object.keys((node as any)?.data?.targets ?? {})) {
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
