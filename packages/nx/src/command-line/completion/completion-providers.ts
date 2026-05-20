import { join } from 'path';
import { workspaceRoot } from '../../utils/workspace-root';
import { readCachedProjectGraph } from '../../project-graph/project-graph';
import { readJsonFile } from '../../utils/fileutils';
import type { ProjectGraph } from '../../config/project-graph';

/** Stale graphs are intentionally tolerated — do not "fix" by triggering
 *  a recompute. readCachedProjectGraph throws if no cache exists; we
 *  swallow because completion must always degrade silently. */
function getCachedProjectGraph(): ProjectGraph | null {
  try {
    return readCachedProjectGraph();
  } catch {
    return null;
  }
}

/** Project names matching `current`. */
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

/** Projects that declare `targetName`, matching `current`. */
export function getProjectNamesWithTarget(
  current: string,
  targetName: string
): string[] {
  const graph = getCachedProjectGraph();
  if (!graph?.nodes) {
    return [];
  }
  const matches: string[] = [];
  for (const [name, node] of Object.entries(graph.nodes)) {
    if (node?.data?.targets && targetName in node.data.targets) {
      if (!current || name.startsWith(current)) {
        matches.push(name);
      }
    }
  }
  return matches;
}

/** Two-stage `project[:target]` — stage 1 emits `project:` (nospace), stage 2 emits `project:target`. */
export function completeProjectTarget(current: string): string[] {
  const colonIdx = current.indexOf(':');
  if (colonIdx === -1) {
    return getProjectNameCompletions(current).map((p) => `${p}:`);
  }
  const projectName = current.slice(0, colonIdx);
  const targetPrefix = current.slice(colonIdx + 1);
  return getTargetNamesForProject(targetPrefix, projectName).map(
    (t) => `${projectName}:${t}`
  );
}

/** Generator completion. Stage 1 (`nx g <TAB>`) emits plugin names (with `:`)
 *  and bare generator names (for `nx g application`); stage 2 emits
 *  `plugin:generator`. */
export function completeGenerator(current: string): string[] {
  const colonIdx = current.indexOf(':');
  if (colonIdx !== -1) {
    const pluginName = current.slice(0, colonIdx);
    const generatorPrefix = current.slice(colonIdx + 1);
    return getGeneratorsForPlugin(pluginName, generatorPrefix).map(
      (g) => `${pluginName}:${g}`
    );
  }

  // No prefix on the plugin map — we need every plugin to enumerate bare
  // generator names; dedup bare names across plugins.
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

/** Plugin names matching `current` — installed npm plugins + workspace-local
 *  plugin projects, only those declaring a generator collection. */
export function getGeneratorPluginCompletions(current: string): string[] {
  return [...collectPluginDirs(current).keys()];
}

/** Generator names in a single plugin, matching `current`. */
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

interface PluginDir {
  dir: string;
  field: string;
}

/** plugin name → { dir, generators-collection path }. Workspace-local
 *  plugins win over same-named installed ones. `prefix` skips non-matching
 *  installed deps before reading their package.json. */
function collectPluginDirs(prefix = ''): Map<string, PluginDir> {
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
    const root = node?.data?.root;
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
    return readJsonFile(path);
  } catch {
    return null;
  }
}

/** Unique target names across the workspace, matching `current`. */
export function getTargetNameCompletions(current: string): string[] {
  const graph = getCachedProjectGraph();
  if (!graph?.nodes) return [];
  const targetSet = new Set<string>();
  for (const node of Object.values(graph.nodes)) {
    for (const target of Object.keys(node?.data?.targets ?? {})) {
      targetSet.add(target);
    }
  }
  const targets = [...targetSet];
  return current ? targets.filter((t) => t.startsWith(current)) : targets;
}

/** Target names for a single project, matching `current`. Falls back to
 *  workspace-wide if the project isn't in the graph — covers the
 *  `project:t<TAB>` case where the user is still typing the project name. */
export function getTargetNamesForProject(
  current: string,
  projectName: string
): string[] {
  const graph = getCachedProjectGraph();
  if (!graph?.nodes) return [];
  const node = graph.nodes[projectName];
  if (!node) return getTargetNameCompletions(current);
  const targets = Object.keys(node?.data?.targets ?? {});
  return current ? targets.filter((t) => t.startsWith(current)) : targets;
}
