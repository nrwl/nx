import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import { readNxJson, updateNxJson } from '../../generators/utils/nx-json';
import { Tree } from '../../generators/tree';
import type {
  TargetDefaultEntry,
  TargetDefaultsRecord,
} from '../../config/nx-json';
import type { ProjectGraph } from '../../config/project-graph';
import {
  createProjectGraphAsync,
  readCachedProjectGraph,
} from '../../project-graph/project-graph';
import { isGlobPattern } from '../../utils/globs';
import { logger } from '../../utils/logger';

/**
 * Converts the legacy record-shape `targetDefaults` in nx.json to the new
 * array shape introduced in Nx 23. No-op when `targetDefaults` is absent
 * or already an array.
 *
 * Disambiguation strategy for record keys (highest precedence first):
 * 1. Glob → `{ target: key }`.
 * 2. Project graph available: replicate legacy lookup by checking whether
 *    the key matches a target name and/or an executor string anywhere in
 *    the workspace. Emit one entry, or both when it matches both
 *    (genuinely ambiguous; safer to duplicate than drop a default).
 * 3. No graph or no match found: fall back to the syntactic heuristic —
 *    `:` (and not a glob) → executor; otherwise target.
 */
export default async function convertTargetDefaultsToArray(
  tree: Tree,
  projectGraph?: ProjectGraph
): Promise<void> {
  if (!tree.exists('nx.json')) {
    return;
  }

  const nxJson = readNxJson(tree);
  if (!nxJson) return;

  const { targetDefaults } = nxJson;
  if (!targetDefaults) return;
  if (Array.isArray(targetDefaults)) return;

  const graph = projectGraph ?? (await tryCreateProjectGraph());

  const legacy = targetDefaults as TargetDefaultsRecord;
  const entries: TargetDefaultEntry[] = [];
  for (const key of Object.keys(legacy)) {
    const value = legacy[key] ?? {};
    entries.push(...legacyKeyToEntries(key, value, graph));
  }

  nxJson.targetDefaults = entries;
  updateNxJson(tree, nxJson);

  await formatChangedFilesWithPrettierIfAvailable(tree);
}

/**
 * Treat a legacy record key as an executor when it contains `:` and is
 * not a glob (executor strings are `pkg:name`; globs would also contain
 * `*` / `{` / etc., which `isGlobPattern` catches). Used only as a
 * syntactic fallback when no graph signal is available.
 */
export function isExecutorLikeKey(key: string): boolean {
  return key.includes(':') && !isGlobPattern(key);
}

function legacyKeyToEntries(
  key: string,
  value: Partial<TargetDefaultEntry>,
  graph: ProjectGraph | undefined
): TargetDefaultEntry[] {
  if (isGlobPattern(key)) {
    return [{ ...value, target: key }];
  }

  if (graph) {
    const { matchesTargetName, matchesExecutor } = classifyKeyAgainstGraph(
      key,
      graph
    );
    if (matchesTargetName && matchesExecutor) {
      return [
        { ...value, target: key },
        { ...value, executor: key },
      ];
    }
    if (matchesTargetName) return [{ ...value, target: key }];
    if (matchesExecutor) return [{ ...value, executor: key }];
    // Fall through to the syntactic heuristic when the workspace has
    // neither a target named `key` nor a target using executor `key`.
  }

  return isExecutorLikeKey(key)
    ? [{ ...value, executor: key }]
    : [{ ...value, target: key }];
}

function classifyKeyAgainstGraph(
  key: string,
  graph: ProjectGraph
): { matchesTargetName: boolean; matchesExecutor: boolean } {
  let matchesTargetName = false;
  let matchesExecutor = false;
  for (const node of Object.values(graph.nodes ?? {})) {
    const targets = node?.data?.targets;
    if (!targets) continue;
    for (const [name, target] of Object.entries(targets)) {
      if (!matchesTargetName && name === key) matchesTargetName = true;
      if (!matchesExecutor && target?.executor === key) matchesExecutor = true;
      if (matchesTargetName && matchesExecutor) {
        return { matchesTargetName, matchesExecutor };
      }
    }
  }
  return { matchesTargetName, matchesExecutor };
}

async function tryCreateProjectGraph(): Promise<ProjectGraph | undefined> {
  // Prefer a cached graph so we don't pay the build cost twice when one
  // already exists (e.g. earlier migrations in the same run that built
  // it themselves). `readCachedProjectGraph` throws if no cache is
  // available — fall through to building one in that case.
  try {
    return readCachedProjectGraph();
  } catch {}

  // The graph may fail to build mid-migration (e.g. another change
  // earlier in the same migrate run left the workspace transiently
  // inconsistent). Falling back to the syntactic heuristic is safer
  // than aborting, but warn so users know `:` keys are being
  // disambiguated by shape rather than by graph evidence.
  try {
    return await createProjectGraphAsync();
  } catch (err) {
    logger.warn(
      'convert-target-defaults-to-array: project graph could not be built; ' +
        'falling back to syntactic disambiguation for `:` keys in nx.json `targetDefaults`. ' +
        'If a key happens to match both a target name and an executor in your workspace, ' +
        'review the migration result and add the missing entry by hand. ' +
        `Underlying error: ${err instanceof Error ? err.message : String(err)}`
    );
    return undefined;
  }
}
