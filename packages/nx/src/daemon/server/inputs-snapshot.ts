import { stat as statAsync } from 'node:fs/promises';
import { isAbsolute, join, resolve as pathResolve } from 'node:path';

import { workspaceRoot } from '../../utils/workspace-root';
import { globWithWorkspaceContext } from '../../utils/workspace-context';
import { readNxJson } from '../../config/nx-json';
import type { LoadedNxPlugin } from '../../project-graph/plugins/loaded-nx-plugin';
import type { SeparatedPlugins } from '../../project-graph/plugins/get-plugins';
import type { PluginConfiguration } from '../../config/nx-json';
import { serverLogger } from '../logger';

/**
 * Drift signal returned to the daemon's staleness check. The daemon serves
 * the cached graph only when this is `null`; any other value forces a
 * recompute and is logged for diagnostics.
 */
export type InputsDriftReason =
  | { kind: 'nx-json'; previous: string; current: string }
  | {
      kind: 'root-package-json';
      previous: string;
      current: string;
    }
  | {
      kind: 'plugin-source';
      path: string;
      previous: string;
      current: string;
    }
  | {
      kind: 'plugin-input';
      path: string;
      previous: string;
      current: string;
    };

/**
 * Snapshot of every input that fed the cached project graph. Captured at
 * compute completion and consulted on every cache-hit decision so the
 * daemon does not depend on the file watcher to observe config drift.
 *
 * - `nxJsonSignature` / `rootPackageJsonSignature` cover the small
 *   workspace-level configs. Stat-based (`ino:size:mtimeNs:ctimeNs`):
 *   any write bumps mtime/ctime, so even same-length content rewrites
 *   register as drift. Same shape as the plugin-source/input checks
 *   below — keeps the layered staleness check uniform and avoids
 *   reading file contents on the hot path.
 * - `pluginSources` covers workspace-local plugins (specifiers like
 *   `./tools/foo`) whose source file changing means the loader produces
 *   different behavior even with an unchanged plugins list. Entries for
 *   npm-resolved plugins are intentionally absent — those are versioned
 *   via package.json / lockfile and don't drift between requests.
 * - `pluginInputs` is the union of files matched by every loaded
 *   plugin's createNodesV2 glob, with a stat-based signature each. This
 *   is the largest set; signing with `${ino}:${size}:${mtimeNs}:${ctimeNs}`
 *   captures every realistic edit, atomic-replace, and unlink while
 *   staying single-digit microseconds per file.
 */
export interface InputsSnapshot {
  nxJsonSignature: string;
  rootPackageJsonSignature: string;
  pluginSources: Map<string, string>;
  pluginInputs: Map<string, string>;
}

const NX_JSON_PATH = 'nx.json';
const ROOT_PACKAGE_JSON_PATH = 'package.json';
const WORKSPACE_PLUGIN_SOURCE_EXTENSIONS = ['', '.js', '.cjs', '.mjs', '.ts'];

function isWorkspacePluginSpec(spec: string): boolean {
  return spec.startsWith('./') || spec.startsWith('../') || isAbsolute(spec);
}

function getPluginSpecifiers(pluginsConfig: PluginConfiguration[]): string[] {
  return pluginsConfig.map((p) => (typeof p === 'string' ? p : p.plugin));
}

/**
 * Resolve a workspace-relative plugin spec (e.g. `./tools/plugin-foo`) to
 * an absolute file path. Tries common extensions because plugin specs in
 * nx.json are typically extensionless. Returns null if nothing on disk
 * matches — the caller treats that as "no source file to track."
 */
async function resolveWorkspacePluginSource(
  spec: string
): Promise<string | null> {
  const base = isAbsolute(spec) ? spec : pathResolve(workspaceRoot, spec);
  for (const ext of WORKSPACE_PLUGIN_SOURCE_EXTENSIONS) {
    const candidate = ext ? `${base}${ext}` : base;
    try {
      const s = await statAsync(candidate);
      // Skip directories — the entry-point lookup for those goes through
      // the package.json `main` field, which is itself a tracked input.
      if (s.isFile()) return candidate;
    } catch {
      // try next extension
    }
  }
  return null;
}

function statSignature(s: {
  ino: number | bigint;
  size: number | bigint;
  mtimeNs: bigint;
  ctimeNs: bigint;
}): string {
  return `${s.ino}:${s.size}:${s.mtimeNs}:${s.ctimeNs}`;
}

async function readStatSignature(absPath: string): Promise<string> {
  try {
    const s = await statAsync(absPath, { bigint: true });
    return statSignature(s);
  } catch {
    return 'missing';
  }
}

function collectPluginGlobs(plugins: LoadedNxPlugin[]): string[] {
  const globs = new Set<string>();
  for (const plugin of plugins) {
    if (plugin.createNodes) {
      const [glob] = plugin.createNodes;
      if (typeof glob === 'string' && glob.length > 0) {
        globs.add(glob);
      }
    }
  }
  return Array.from(globs);
}

async function buildPluginInputsMap(
  plugins: LoadedNxPlugin[]
): Promise<Map<string, string>> {
  const globs = collectPluginGlobs(plugins);
  if (globs.length === 0) return new Map();

  let matches: string[];
  try {
    matches = await globWithWorkspaceContext(workspaceRoot, globs);
  } catch (e) {
    serverLogger.log(
      `[input-drift] glob failed while building snapshot: ${
        e instanceof Error ? e.message : String(e)
      }`
    );
    return new Map();
  }

  const entries = await Promise.all(
    matches.map(async (rel): Promise<[string, string]> => {
      const sig = await readStatSignature(join(workspaceRoot, rel));
      return [rel, sig];
    })
  );
  return new Map(entries);
}

async function buildPluginSourcesMap(
  pluginsConfig: PluginConfiguration[]
): Promise<Map<string, string>> {
  const specs = getPluginSpecifiers(pluginsConfig).filter(
    isWorkspacePluginSpec
  );
  if (specs.length === 0) return new Map();

  const entries = await Promise.all(
    specs.map(async (spec): Promise<[string, string] | null> => {
      const abs = await resolveWorkspacePluginSource(spec);
      if (!abs) return null;
      const sig = await readStatSignature(abs);
      return [abs, sig];
    })
  );

  return new Map(entries.filter((e): e is [string, string] => e !== null));
}

/**
 * Workspace-level inputs that are READ by `getPluginsSeparated` to
 * determine the plugin set: nx.json itself, root package.json, and any
 * workspace plugin source files that the loader will resolve. Capture
 * happens BEFORE `getPluginsSeparated` runs so the snapshot reflects
 * the disk state the compute will use, not whatever disk shows after
 * compute finishes (which can already be the next test's write).
 */
export interface PreComputeInputs {
  nxJsonSignature: string;
  rootPackageJsonSignature: string;
  pluginSources: Map<string, string>;
}

export async function capturePreComputeInputs(): Promise<PreComputeInputs> {
  let pluginsConfig: PluginConfiguration[] = [];
  try {
    pluginsConfig = readNxJson(workspaceRoot).plugins ?? [];
  } catch (e) {
    serverLogger.log(
      `[input-drift] readNxJson failed during pre-compute snapshot: ${
        e instanceof Error ? e.message : String(e)
      }`
    );
  }

  const [nxJsonSignature, rootPackageJsonSignature, pluginSources] =
    await Promise.all([
      readStatSignature(join(workspaceRoot, NX_JSON_PATH)),
      readStatSignature(join(workspaceRoot, ROOT_PACKAGE_JSON_PATH)),
      buildPluginSourcesMap(pluginsConfig),
    ]);

  return { nxJsonSignature, rootPackageJsonSignature, pluginSources };
}

/**
 * Plugin-level inputs: the union of files matched by every loaded
 * plugin's createNodesV2 glob. Must be captured AFTER plugin loading
 * because the glob list comes from the loaded plugins themselves.
 * There is a small race window between `getPluginsSeparated` reading
 * disk and this capture running — if a test edits a plugin-watched
 * file in that window, we'd record the post-edit signature and miss
 * drift on the next request. The window is microseconds and the
 * fallout is at most one stale serve, after which the workspace-level
 * pre-compute snapshot or the watcher would force a recompute.
 */
export async function capturePluginInputs(
  separatedPlugins: SeparatedPlugins
): Promise<Map<string, string>> {
  const allPlugins: LoadedNxPlugin[] = [
    ...separatedPlugins.specifiedPlugins,
    ...separatedPlugins.defaultPlugins,
  ];
  return buildPluginInputsMap(allPlugins);
}

/**
 * Stitch the pre-compute and post-compute halves into the canonical
 * `InputsSnapshot` consumed by `detectInputsDrift`.
 */
export function combineInputsSnapshot(
  pre: PreComputeInputs,
  pluginInputs: Map<string, string>
): InputsSnapshot {
  return { ...pre, pluginInputs };
}

/**
 * Compare the captured snapshot against current disk state. Returns the
 * first drift detected (so callers can log a precise reason) or `null`
 * when every input still matches. Order of checks goes cheapest-first:
 * the two workspace-config stats short-circuit before we stat hundreds
 * of plugin inputs.
 */
export async function detectInputsDrift(
  snapshot: InputsSnapshot
): Promise<InputsDriftReason | null> {
  // Layer 1: workspace-level configs. Cheap; covers the spread test's
  // nx.json plugins flake deterministically.
  const currentNxJsonSignature = await readStatSignature(
    join(workspaceRoot, NX_JSON_PATH)
  );
  if (currentNxJsonSignature !== snapshot.nxJsonSignature) {
    return {
      kind: 'nx-json',
      previous: snapshot.nxJsonSignature,
      current: currentNxJsonSignature,
    };
  }
  const currentRootPkgSignature = await readStatSignature(
    join(workspaceRoot, ROOT_PACKAGE_JSON_PATH)
  );
  if (currentRootPkgSignature !== snapshot.rootPackageJsonSignature) {
    return {
      kind: 'root-package-json',
      previous: snapshot.rootPackageJsonSignature,
      current: currentRootPkgSignature,
    };
  }

  // Layer 2: workspace plugin source files. Bounded by plugin count
  // (single digits typically). Stats are cheap, parallelised.
  if (snapshot.pluginSources.size > 0) {
    const sourceDrift = await Promise.all(
      Array.from(snapshot.pluginSources.entries()).map(
        async ([path, previous]): Promise<InputsDriftReason | null> => {
          const current = await readStatSignature(path);
          return current !== previous
            ? { kind: 'plugin-source', path, previous, current }
            : null;
        }
      )
    );
    const firstDrift = sourceDrift.find((d) => d !== null);
    if (firstDrift) return firstDrift;
  }

  // Layer 3: every file each plugin's createNodesV2 glob matched at
  // compute time. Largest set; still bounded by plugin glob breadth.
  if (snapshot.pluginInputs.size > 0) {
    const inputDrift = await Promise.all(
      Array.from(snapshot.pluginInputs.entries()).map(
        async ([rel, previous]): Promise<InputsDriftReason | null> => {
          const current = await readStatSignature(join(workspaceRoot, rel));
          return current !== previous
            ? { kind: 'plugin-input', path: rel, previous, current }
            : null;
        }
      )
    );
    const firstDrift = inputDrift.find((d) => d !== null);
    if (firstDrift) return firstDrift;
  }

  return null;
}

export function describeInputsDrift(reason: InputsDriftReason): string {
  switch (reason.kind) {
    case 'nx-json':
      return `nx.json changed (was ${reason.previous}, now ${reason.current})`;
    case 'root-package-json':
      return `root package.json changed (was ${reason.previous}, now ${reason.current})`;
    case 'plugin-source':
      return `workspace plugin source changed: ${reason.path}`;
    case 'plugin-input':
      return `plugin-watched file changed: ${reason.path}`;
  }
}
