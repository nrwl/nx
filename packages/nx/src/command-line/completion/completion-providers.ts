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
 * project:target above — plus an unqualified-generator path so `nx g
 * application<TAB>` (which Nx resolves to the first matching generator
 * across all plugins) is also completable.
 *
 * Stage 1 (`nx g <TAB>` / `nx g app<TAB>`) returns BOTH the plugin names
 * (with a trailing `:` so the second TAB lists that plugin's generators)
 * AND the bare generator names across all plugins, deduped. The user can
 * either drill into a plugin or pick an unqualified generator.
 *
 * Stage 2 (`nx g @nx/react:<TAB>`) returns that single plugin's
 * generators, qualified.
 */
export function completeGenerator(current: string): string[] {
  const colonIdx = current.indexOf(':');
  if (colonIdx !== -1) {
    const pluginName = current.slice(0, colonIdx);
    const generatorPrefix = current.slice(colonIdx + 1);
    return getGeneratorsForPlugin(pluginName, generatorPrefix).map(
      (g) => `${pluginName}:${g}`
    );
  }

  // Single collectPluginDirs() call (no prefix — we need every plugin to
  // enumerate bare generator names). Plugin names get the trailing `:`;
  // bare names go through a Set to dedup `application` declared in multiple
  // plugins.
  const all = collectPluginDirs();
  const result: string[] = [];
  const bare = new Set<string>();
  for (const [name, entry] of all) {
    if (!current || name.startsWith(current)) {
      result.push(`${name}:`);
    }
    for (const gen of readGeneratorNames(entry.dir, entry.field)) {
      if (!current || gen.startsWith(current)) {
        bare.add(gen);
      }
    }
  }
  for (const gen of bare) {
    result.push(gen);
  }
  return result;
}

/**
 * Returns names of plugins that declare a generator collection, matching the
 * prefix. Covers both installed npm plugins and workspace-local plugin
 * projects (e.g. a `libs/my-plugin` with its own `generators.json`).
 *
 * First stage of `<plugin>:<generator>` completion — the generator names
 * inside each collection are not needed yet, so `generators.json` is not
 * read here.
 */
export function getGeneratorPluginCompletions(current: string): string[] {
  // Every entry collectPluginDirs returns is already a confirmed plugin
  // (declares a `generators`/`schematics` collection), so listing the keys
  // needs no further file reads.
  return [...collectPluginDirs(current).keys()];
}

/**
 * Returns generator names within a single plugin matching the prefix.
 */
export function getGeneratorsForPlugin(
  pluginName: string,
  current: string
): string[] {
  const entry = collectPluginDirs(pluginName).get(pluginName);
  if (!entry) {
    return [];
  }
  const generators = readGeneratorNames(entry.dir, entry.field);
  if (!current) {
    return generators;
  }
  return generators.filter((g) => g.startsWith(current));
}

/** A plugin's directory and the relative path to its generator collection. */
interface PluginDir {
  dir: string;
  field: string;
}

/**
 * Builds a map of collection name → plugin location. Only packages that
 * actually declare a `generators`/`schematics` collection are included.
 * Two sources:
 *   - installed npm plugins — root `package.json` deps, resolved under
 *     `node_modules/<name>`
 *   - workspace-local plugin projects — any project in the cached graph
 *     whose `package.json` declares a `generators`/`schematics` collection
 *
 * A local definition wins over a same-named installed package (the local
 * one is what the user is developing).
 *
 * `prefix` skips installed deps whose name cannot match before their
 * `package.json` is read — the dominant per-keystroke cost once the user
 * has typed part of a plugin name.
 */
function collectPluginDirs(prefix = ''): Map<string, PluginDir> {
  const workspaceRoot = resolveWorkspaceRoot();
  const dirs = new Map<string, PluginDir>();

  const addIfPlugin = (name: string, dir: string): void => {
    const pkg = readJsonSafe(join(dir, 'package.json'));
    const field = pkg?.generators ?? pkg?.schematics;
    if (typeof field === 'string') {
      dirs.set(name, { dir, field });
    }
  };

  const rootPkg = readJsonSafe(join(workspaceRoot, 'package.json'));
  if (rootPkg) {
    const deps = {
      ...(rootPkg.dependencies ?? {}),
      ...(rootPkg.devDependencies ?? {}),
    };
    for (const dep of Object.keys(deps)) {
      if (prefix && !dep.startsWith(prefix)) continue;
      addIfPlugin(dep, join(workspaceRoot, 'node_modules', dep));
    }
  }

  const graph = getCachedProjectGraph();
  for (const node of Object.values(graph?.nodes ?? {})) {
    const root = (node as any)?.data?.root;
    if (typeof root !== 'string' || !root) continue;
    const projectDir = join(workspaceRoot, root);
    const pkg = readJsonSafe(join(projectDir, 'package.json'));
    const field = pkg?.generators ?? pkg?.schematics;
    if (
      pkg?.name &&
      typeof field === 'string' &&
      (!prefix || pkg.name.startsWith(prefix))
    ) {
      dirs.set(pkg.name, { dir: projectDir, field });
    }
  }

  return dirs;
}

/**
 * Reads the non-hidden generator names from the `generators`/`schematics`
 * JSON at `field`, relative to the plugin's `pluginDir`.
 */
function readGeneratorNames(pluginDir: string, field: string): string[] {
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
