import { isAbsolute, relative } from 'path';
import { type NxJsonConfiguration, readNxJson } from '../config/nx-json';
import type {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../config/project-graph';
import type { Task, TaskGraph } from '../config/task-graph';
import type { HashInputs } from '../native';
import { expandOutputs, matchGlobPaths, matchOutputPaths } from '../native';
import { createProjectGraphAsync } from '../project-graph/project-graph';
import { createTaskGraph } from '../tasks-runner/create-task-graph';
import {
  createTaskId,
  getOutputsForTargetAndConfiguration,
} from '../tasks-runner/utils';
import { normalizePath } from '../utils/path';
import { projectHasTargetAndConfiguration } from '../utils/project-graph-utils';
import { splitTarget } from '../utils/split-target';
import { workspaceRoot as defaultWorkspaceRoot } from '../utils/workspace-root';
import { HashPlanInspector } from './hash-plan-inspector';
import { type ExpandedDepsOutput, getInputs } from './task-hasher';

// ── Module-level context (loaded once per process) ───────────────────────────

interface LoadedContext {
  projectGraph: ProjectGraph;
  nxJson: NxJsonConfiguration;
  inspector: HashPlanInspector;
}

let cachedContext: Promise<LoadedContext> | null = null;

function getContext(): Promise<LoadedContext> {
  // Only a fulfilled context is cached — caching a rejected promise would
  // poison the resolver for the rest of the process after one transient failure.
  return (cachedContext ??= loadContext().catch((e) => {
    cachedContext = null;
    throw e;
  }));
}

async function loadContext(): Promise<LoadedContext> {
  const projectGraph = await createProjectGraphAsync();
  const nxJson = readNxJson(defaultWorkspaceRoot) ?? {};
  const inspector = new HashPlanInspector(
    projectGraph,
    defaultWorkspaceRoot,
    nxJson
  );
  await inspector.init();
  return { projectGraph, nxJson, inspector };
}

// ── Per-process caches (valid for the entire process lifetime) ───────────────

interface TaskIdentity {
  project: string;
  target: string;
  configuration: string | undefined;
  canonicalTaskId: string;
  projectNode: ProjectGraphProjectNode;
}

const identityCache = new Map<string, TaskIdentity>();
const hashInputsCache = new Map<string, HashInputs | null>();
const outputsCache = new Map<string, string[]>();
const taskGraphCache = new Map<string, TaskGraph>();
const depsOutputsCache = new Map<string, ExpandedDepsOutput[]>();

// ── Internal resolution helpers ──────────────────────────────────────────────

function resolveIdentity(
  taskId: string,
  projectGraph: ProjectGraph
): TaskIdentity {
  const cached = identityCache.get(taskId);
  if (cached) return cached;

  const [project, target, configuration] = splitTarget(taskId, projectGraph);
  if (!project || !target) {
    throw new Error(
      `Invalid taskId "${taskId}" — expected "project:target[:configuration]"`
    );
  }

  const projectNode = projectGraph.nodes[project];
  if (!projectNode) {
    throw new Error(
      `Invalid taskId "${taskId}" — project "${project}" does not exist in the project graph.`
    );
  }
  const targetConfig = projectNode.data?.targets?.[target];
  if (!targetConfig) {
    throw new Error(
      `Invalid taskId "${taskId}" — project "${project}" has no target "${target}".`
    );
  }

  // Substituting defaultConfiguration for a configuration that does not exist
  // would answer confidently about a *different* task — and configurations
  // routinely change `outputPath`, so the answer could be wrong in either
  // direction. `nx run` errors here; so do we.
  if (
    configuration &&
    !projectHasTargetAndConfiguration(projectNode, target, configuration)
  ) {
    const available = Object.keys(targetConfig.configurations ?? {});
    throw new Error(
      `Invalid taskId "${taskId}" — target "${target}" of project "${project}" has no configuration "${configuration}".` +
        (available.length
          ? ` Available configurations: ${available.join(', ')}.`
          : ' It has no configurations.')
    );
  }

  const effectiveConfiguration =
    configuration ?? targetConfig.defaultConfiguration;

  const identity: TaskIdentity = {
    project,
    target,
    configuration: effectiveConfiguration,
    canonicalTaskId: createTaskId(project, target, effectiveConfiguration),
    projectNode,
  };
  identityCache.set(taskId, identity);
  return identity;
}

function getRawInputs(
  taskId: string,
  { projectGraph, inspector }: LoadedContext
): HashInputs | null {
  if (hashInputsCache.has(taskId)) {
    return hashInputsCache.get(taskId) ?? null;
  }

  const { project, target, configuration, canonicalTaskId } = resolveIdentity(
    taskId,
    projectGraph
  );

  // `null` means "this task is absent from the hash plan" — any other failure
  // is a real error and propagates to the caller.
  const planResult = inspector.inspectTaskInputs({
    project,
    target,
    configuration,
  });

  const result = planResult[canonicalTaskId] ?? null;
  hashInputsCache.set(taskId, result);
  return result;
}

function getOutputs(taskId: string, projectGraph: ProjectGraph): string[] {
  const cached = outputsCache.get(taskId);
  if (cached !== undefined) return cached;

  const { project, target, configuration, projectNode } = resolveIdentity(
    taskId,
    projectGraph
  );
  const outputs = getOutputsForTargetAndConfiguration(
    { project, target, configuration },
    {},
    projectNode
  ).map(normalizePath);

  outputsCache.set(taskId, outputs);
  return outputs;
}

/**
 * Configured outputs that `getOutputsForTargetAndConfiguration` dropped because
 * an `{options.x}` token had no value to interpolate. The resolver discards them
 * silently, so they have to be recovered from the target configuration.
 */
function getUnresolvedOutputs(
  taskId: string,
  projectGraph: ProjectGraph
): string[] {
  const { target, configuration, projectNode } = resolveIdentity(
    taskId,
    projectGraph
  );
  const targetConfig = projectNode.data.targets[target];
  const options = {
    ...targetConfig.options,
    ...(configuration
      ? targetConfig.configurations?.[configuration]
      : undefined),
  };

  return (targetConfig.outputs ?? []).filter((output) =>
    [...output.matchAll(/\{options\.([^}]+)\}/g)].some(([, key]) => {
      const value = key.split('.').reduce<any>((acc, k) => acc?.[k], options);
      return value === undefined;
    })
  );
}

function getTaskGraph(taskId: string, projectGraph: ProjectGraph): TaskGraph {
  const cached = taskGraphCache.get(taskId);
  if (cached) return cached;

  const { project, target, configuration } = resolveIdentity(
    taskId,
    projectGraph
  );
  const taskGraph = createTaskGraph(
    projectGraph,
    {},
    [project],
    [target],
    configuration,
    {},
    false
  );

  taskGraphCache.set(taskId, taskGraph);
  return taskGraph;
}

function getDepsOutputs(
  taskId: string,
  { projectGraph, nxJson }: LoadedContext
): ExpandedDepsOutput[] {
  if (depsOutputsCache.has(taskId)) return depsOutputsCache.get(taskId)!;

  const { project, target } = resolveIdentity(taskId, projectGraph);
  const result =
    getInputs({ target: { project, target } } as Task, projectGraph, nxJson)
      .depsOutputs ?? [];

  depsOutputsCache.set(taskId, result);
  return result;
}

function collectUpstreamTaskIds(
  taskGraph: TaskGraph,
  rootTaskId: string,
  transitive: boolean
): string[] {
  const direct = taskGraph.dependencies[rootTaskId] ?? [];
  if (!transitive) return [...direct];

  const collected = new Set<string>();
  const walk = (id: string): void => {
    for (const dep of taskGraph.dependencies[id] ?? []) {
      if (collected.has(dep)) continue;
      collected.add(dep);
      walk(dep);
    }
  };
  walk(rootTaskId);
  return [...collected];
}

/**
 * Matches a single path against a task's whole output pattern list using the
 * native glob engine (`globset`) that the task runner's expand_outputs also
 * builds on: non-glob patterns match themselves and anything nested under them,
 * and negated (`!`-prefixed) patterns act as exclusions over the full set.
 */
function isOutput(
  taskId: string,
  path: string,
  projectGraph: ProjectGraph
): boolean {
  const patterns = getOutputs(taskId, projectGraph);
  return matchOutputPaths(patterns, [normalizePath(path)])[0];
}

function matchesDependentTaskOutputs(
  taskId: string,
  path: string,
  ctx: LoadedContext
): boolean {
  const normalized = normalizePath(path);
  const depsOutputs = getDepsOutputs(taskId, ctx);
  if (depsOutputs.length === 0) return false;

  const taskGraph = getTaskGraph(taskId, ctx.projectGraph);
  const { canonicalTaskId } = resolveIdentity(taskId, ctx.projectGraph);
  if (!taskGraph.tasks[canonicalTaskId]) return false;

  for (const { dependentTasksOutputFiles, transitive } of depsOutputs) {
    const glob = normalizePath(dependentTasksOutputFiles);
    if (!matchGlobPaths([glob], [normalized])[0]) continue;
    const upstreamIds = collectUpstreamTaskIds(
      taskGraph,
      canonicalTaskId,
      !!transitive
    );
    for (const upstreamId of upstreamIds) {
      if (isOutput(upstreamId, normalized, ctx.projectGraph)) return true;
    }
  }
  return false;
}

/**
 * Coerces a caller-supplied path to the workspace-relative, forward-slashed
 * form the hash plan and output patterns are expressed in. A path outside the
 * workspace stays outside (`../…`) and simply matches nothing — it cannot be a
 * declared input or output, so "unmatched" is the true answer rather than an
 * error.
 */
function toWorkspaceRelativePath(candidatePath: string): string {
  const relativized = isAbsolute(candidatePath)
    ? relative(defaultWorkspaceRoot, candidatePath)
    : candidatePath;
  const normalized = normalizePath(relativized);
  return normalized.startsWith('./') ? normalized.slice(2) : normalized;
}

/**
 * The task's hash inputs, or an error. A task missing from its own hash plan is
 * a failure to *determine* the inputs — reporting every file as unmatched would
 * tell a sandbox-violation consumer that all of them are illegal.
 */
function requireRawInputs(taskId: string, ctx: LoadedContext): HashInputs {
  const raw = getRawInputs(taskId, ctx);
  if (!raw) {
    throw new Error(
      `Could not determine the inputs of task "${taskId}" — it is not present in its own hash plan.`
    );
  }
  return raw;
}

function classifyInput(
  taskId: string,
  candidate: InputCandidate,
  raw: HashInputs,
  ctx: LoadedContext
): InputCategory | null {
  // `environment`, `runtime` and `external` hold names rather than paths, so
  // they are matched against the value exactly as the caller supplied it.
  if (raw.environment.includes(candidate.value)) return 'environment';
  if (raw.runtime.includes(candidate.value)) return 'runtime';
  if (raw.external.includes(candidate.value)) return 'external';

  const path = toWorkspaceRelativePath(candidate.path);
  if (raw.files.includes(path)) return 'files';
  if (raw.depOutputs.includes(path)) return 'depOutputs';

  return matchesDependentTaskOutputs(taskId, path, ctx)
    ? 'dependentTasksOutputFiles'
    : null;
}

// ── API (exported from devkit-internals) ─────────────────────────────────────
//
// Paths may be given workspace-relative or absolute, in either separator style;
// absolute paths are relativized against the workspace root. There is still no
// cwd of its own, so a caller holding *cwd-relative* paths must resolve them
// first (pass an {@link InputCandidate} to keep the original value in the
// result).
//
// The module-level context and caches above are loaded once and never
// invalidated, which is only sound for a one-shot process (the CLI, or a
// short-lived light client). A long-lived caller would read stale results after
// any workspace change.

/** The rule that made a value an input for a task. */
export type InputCategory =
  | 'files'
  | 'depOutputs'
  | 'dependentTasksOutputFiles'
  | 'runtime'
  | 'environment'
  | 'external';

export interface InputCandidate {
  /** The value as supplied — matched verbatim against environment/runtime/external. */
  value: string;
  /** Workspace-relative path form of `value` — matched against the path categories. */
  path: string;
}

/**
 * Check which values are legitimate inputs for the given task. A value matches
 * when it is:
 *   - a declared environment variable, runtime input, or external dependency;
 *   - a file in the task's declared input file list;
 *   - a file in the task's materialized `depOutputs` (upstream has run);
 *   - a file matching a `dependentTasksOutputFiles` glob declared on the task
 *     that lies inside the declared outputs of an upstream task in the task
 *     graph (static — works even when upstream tasks have not yet run).
 *
 * `categories` records the rule each matched value satisfied. Paths may be
 * workspace-relative or absolute; absolute ones are relativized against the
 * workspace root, and a path outside the workspace simply matches nothing. A
 * caller resolving paths against a cwd passes an {@link InputCandidate} so that
 * names are still matched verbatim.
 */
export async function checkFilesAreInputs(
  taskId: string,
  files: Array<string | InputCandidate>
): Promise<{
  matched: string[];
  unmatched: string[];
  categories: Map<string, InputCategory>;
}> {
  const ctx = await getContext();
  // Resolve the task and its hash plan eagerly, so an unknown task or an
  // undeterminable plan errors even when the file list is empty — rather than
  // being reported as "none of these files are inputs".
  resolveIdentity(taskId, ctx.projectGraph);
  const raw = requireRawInputs(taskId, ctx);

  const matched: string[] = [];
  const unmatched: string[] = [];
  const categories = new Map<string, InputCategory>();

  for (const file of files) {
    const candidate =
      typeof file === 'string' ? { value: file, path: file } : file;
    const category = classifyInput(taskId, candidate, raw, ctx);
    if (category) {
      matched.push(candidate.value);
      categories.set(candidate.value, category);
    } else {
      unmatched.push(candidate.value);
    }
  }

  return { matched, unmatched, categories };
}

/**
 * Check which files match the output globs declared for the given task.
 * Uses the same path-matching logic as the task runner (directory containment
 * + glob matching through the native `globset` engine), including negated
 * (`!`-prefixed) patterns acting as exclusions over the whole pattern set.
 *
 * Paths may be workspace-relative or absolute; absolute ones are relativized
 * against the workspace root. An output pattern whose `{options.*}` token has no
 * value resolves to nothing — exactly as the task runner drops it — so a file it
 * would have covered is reported `unmatched`, like any other non-output.
 */
export async function checkFilesAreOutputs(
  taskId: string,
  files: string[]
): Promise<{ matched: string[]; unmatched: string[] }> {
  const ctx = await getContext();
  // Validate taskId eagerly so callers always get an error for an unknown or
  // malformed task, even when the file list is empty.
  resolveIdentity(taskId, ctx.projectGraph);
  const patterns = getOutputs(taskId, ctx.projectGraph);
  const results = matchOutputPaths(
    patterns,
    files.map(toWorkspaceRelativePath)
  );
  const matched: string[] = [];
  const unmatched: string[] = [];
  files.forEach((file, i) => {
    if (results[i]) {
      matched.push(file);
    } else {
      unmatched.push(file);
    }
  });
  return { matched, unmatched };
}

// ── Renderer helpers (used by `nx show target`) ──────────────────────────────

/**
 * Returns the full hash inputs for a task (files + runtime + env + depOutputs
 * + external). Used internally by the `nx show target --inputs` renderer.
 */
export async function getTaskRawInputs(
  taskId: string
): Promise<HashInputs | null> {
  const ctx = await getContext();
  return getRawInputs(taskId, ctx);
}

export interface TaskOutputs {
  /** Output patterns after token substitution — what the task runner will cache. */
  resolved: string[];
  /** `resolved`, expanded against the files currently on disk. */
  expanded: string[];
  /** Configured outputs left out of `resolved` because an option had no value. */
  unresolved: string[];
}

/**
 * Returns the outputs declared for a task, resolved against its effective
 * configuration. Used internally by the `nx show target --outputs` renderer.
 */
export async function getTaskOutputs(taskId: string): Promise<TaskOutputs> {
  const ctx = await getContext();
  const resolved = getOutputs(taskId, ctx.projectGraph);
  return {
    resolved,
    expanded: expandOutputs(defaultWorkspaceRoot, resolved),
    unresolved: getUnresolvedOutputs(taskId, ctx.projectGraph),
  };
}

// ── Test utilities ───────────────────────────────────────────────────────────

/**
 * Resets all module-level caches. Call this in `beforeEach` when testing so
 * each test gets a fresh context load. Not part of the public API.
 * @internal
 */
export function _resetContextForTesting(): void {
  cachedContext = null;
  identityCache.clear();
  hashInputsCache.clear();
  outputsCache.clear();
  taskGraphCache.clear();
  depsOutputsCache.clear();
}
