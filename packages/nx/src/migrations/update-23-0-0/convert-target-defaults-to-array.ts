import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import { readNxJson, updateNxJson } from '../../generators/utils/nx-json';
import { Tree } from '../../generators/tree';
import type {
  TargetDefaultEntry,
  TargetDefaultsRecord,
} from '../../config/nx-json';
import type { ProjectGraph } from '../../config/project-graph';
import { createProjectGraphAsync } from '../../project-graph/project-graph';
import { isGlobPattern } from '../../utils/globs';

/**
 * Converts the legacy record-shape `targetDefaults` in nx.json to the new
 * array shape introduced in Nx 23. No-op when `targetDefaults` is absent
 * or already an array.
 *
 * This is a pure shape conversion: every legacy key produces at least one
 * array entry, nothing is ever dropped. A key that looks unused at
 * migration time may still be a live default — the target can be added
 * later, and the project graph at migration time can be incomplete.
 *
 * A project graph is built internally (and only when needed) to
 * disambiguate `:`-style keys; see {@link convertTargetDefaultsRecordToArray}.
 */
export default async function convertTargetDefaultsToArray(
  tree: Tree
): Promise<string[]> {
  if (!tree.exists('nx.json')) {
    return [];
  }

  const nxJson = readNxJson(tree);
  if (!nxJson) return [];

  const { targetDefaults } = nxJson;
  if (!targetDefaults) return [];
  if (Array.isArray(targetDefaults)) return [];

  const legacy = targetDefaults as TargetDefaultsRecord;
  const nextSteps: string[] = [];

  // The graph is only consulted to disambiguate `:`-style keys (target name
  // vs `pkg:executor` id). Skip building it entirely when there are none.
  const graph = Object.keys(legacy).some(isExecutorAmbiguousKey)
    ? await tryCreateProjectGraph(nextSteps)
    : undefined;

  nxJson.targetDefaults = convertTargetDefaultsRecordToArray(legacy, graph);
  updateNxJson(tree, nxJson);

  await formatChangedFilesWithPrettierIfAvailable(tree);
  return nextSteps;
}

/**
 * Pure conversion from the legacy record shape to the array shape.
 *
 * Kept separate from the migration entry point — and accepting the graph
 * as an explicit argument — so the disambiguation logic can be unit tested
 * directly with synthetic graphs. The migration runner never hands a
 * migration a project graph, so this seam is what keeps that behaviour
 * testable without standing up a real workspace.
 *
 * Disambiguation per key:
 * - A glob, or a plain key with no `:`, is unambiguously a target name.
 * - A `:` key is ambiguous (target name vs `pkg:executor` id). When the
 *   graph shows it used as a target name, an executor, or both, the
 *   matching entry/entries are emitted. With no graph signal, it falls
 *   back to the syntactic heuristic (`:` → executor). Either way an entry
 *   is always emitted.
 */
export function convertTargetDefaultsRecordToArray(
  legacy: TargetDefaultsRecord,
  graph?: ProjectGraph
): TargetDefaultEntry[] {
  const entries: TargetDefaultEntry[] = [];
  for (const key of Object.keys(legacy)) {
    const value = legacy[key] ?? {};
    entries.push(...legacyKeyToEntries(key, value, graph));
  }
  return entries;
}

/**
 * A legacy record key is ambiguous between a target name and an executor
 * id only when it contains `:` and is not a glob (executor ids are
 * `pkg:name`; globs would also contain `*` / `{` / etc., which
 * `isGlobPattern` catches). These are the only keys the graph helps with.
 */
function isExecutorAmbiguousKey(key: string): boolean {
  return key.includes(':') && !isGlobPattern(key);
}

function legacyKeyToEntries(
  key: string,
  value: Partial<TargetDefaultEntry>,
  graph: ProjectGraph | undefined
): TargetDefaultEntry[] {
  // Globs and plain (no `:`) keys are unambiguously target names.
  if (!isExecutorAmbiguousKey(key)) {
    return [{ target: key, ...value }];
  }

  // A `:` key could be a target name or a `pkg:executor` id. Use the graph
  // to disambiguate when it has something to say.
  if (graph) {
    const { matchesTargetName, matchesExecutor } = classifyKeyAgainstGraph(
      key,
      graph
    );
    if (matchesTargetName && matchesExecutor) {
      return [
        { target: key, ...value },
        { executor: key, ...value },
      ];
    }
    if (matchesTargetName) return [{ target: key, ...value }];
    if (matchesExecutor) return [{ executor: key, ...value }];
    // Graph had no signal for this key — fall through to the syntactic
    // heuristic rather than dropping the entry.
  }

  // Syntactic fallback: a `:` key that is not a glob is an executor id.
  return [{ executor: key, ...value }];
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

async function tryCreateProjectGraph(
  nextSteps: string[]
): Promise<ProjectGraph | undefined> {
  // Build fresh — earlier migrations in this run may have mutated files
  // the cached graph was computed from, so a cache hit could classify
  // record keys against a stale workspace.
  try {
    return await createProjectGraphAsync();
  } catch (err) {
    nextSteps.push(
      'convert-target-defaults-to-array: project graph could not be built; ' +
        'falling back to syntactic disambiguation for `:` keys in nx.json `targetDefaults`. ' +
        'If a key happens to match both a target name and an executor in your workspace, ' +
        'review the migration result and add the missing entry by hand. ' +
        `Underlying error: ${err instanceof Error ? err.message : String(err)}`
    );
    return undefined;
  }
}
