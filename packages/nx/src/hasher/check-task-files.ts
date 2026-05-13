import { type NxJsonConfiguration, readNxJson } from '../config/nx-json';
import type {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../config/project-graph';
import type { Task, TaskGraph } from '../config/task-graph';
import type { HashInputs } from '../native';
import { createProjectGraphAsync } from '../project-graph/project-graph';
import { createTaskGraph } from '../tasks-runner/create-task-graph';
import {
  createTaskId,
  getOutputsForTargetAndConfiguration,
} from '../tasks-runner/utils';
import { getMatchingStringsWithCache } from '../utils/find-matching-projects';
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
  return (cachedContext ??= loadContext());
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
  projectNode: ProjectGraphProjectNode | undefined;
}

const identityCache = new Map<string, TaskIdentity>();
const hashInputsCache = new Map<string, HashInputs | null>();
const outputsCache = new Map<string, string[]>();
const taskGraphCache = new Map<string, TaskGraph | null>();
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
  const defaultConfiguration =
    projectNode?.data?.targets?.[target]?.defaultConfiguration;
  const effectiveConfiguration =
    configuration && projectNode
      ? projectHasTargetAndConfiguration(projectNode, target, configuration)
        ? configuration
        : defaultConfiguration
      : defaultConfiguration;

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

  let planResult: Record<string, HashInputs> = {};
  try {
    planResult = inspector.inspectTaskInputs({
      project,
      target,
      configuration,
    });
  } catch {
    hashInputsCache.set(taskId, null);
    return null;
  }

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
  const targetData = projectNode?.data?.targets?.[target];
  const outputs = targetData
    ? getOutputsForTargetAndConfiguration(
        { project, target, configuration },
        {},
        projectNode
      )
    : [];

  outputsCache.set(taskId, outputs);
  return outputs;
}

function getTaskGraph(
  taskId: string,
  projectGraph: ProjectGraph
): TaskGraph | null {
  if (taskGraphCache.has(taskId)) return taskGraphCache.get(taskId) ?? null;

  const { project, target, configuration, projectNode } = resolveIdentity(
    taskId,
    projectGraph
  );
  if (!projectNode) {
    taskGraphCache.set(taskId, null);
    return null;
  }

  let tg: TaskGraph | null = null;
  try {
    tg = createTaskGraph(
      projectGraph,
      {},
      [project],
      [target],
      configuration,
      {},
      false
    );
  } catch {
    tg = null;
  }
  taskGraphCache.set(taskId, tg);
  return tg;
}

function getDepsOutputs(
  taskId: string,
  { projectGraph, nxJson }: LoadedContext
): ExpandedDepsOutput[] {
  if (depsOutputsCache.has(taskId)) return depsOutputsCache.get(taskId)!;

  const { project, target, projectNode } = resolveIdentity(
    taskId,
    projectGraph
  );
  if (!projectNode?.data?.targets?.[target]) {
    depsOutputsCache.set(taskId, []);
    return [];
  }

  let result: ExpandedDepsOutput[] = [];
  try {
    result =
      getInputs({ target: { project, target } } as Task, projectGraph, nxJson)
        .depsOutputs ?? [];
  } catch {
    result = [];
  }
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
 * True if `path` is covered by `pattern`. Two cases:
 *   1. Directory containment — `path` lives inside `pattern` as a directory prefix.
 *   2. Exact / glob match via cached minimatch regex (getMatchingStringsWithCache).
 *
 * No canonical helper exists that combines directory-prefix containment with
 * glob matching; `getMatchingStringsWithCache` handles globs only.
 */
function pathMatchesPattern(normalizedPath: string, pattern: string): boolean {
  const np = normalizePath(pattern);
  if (normalizedPath.startsWith(np + '/')) return true;
  return getMatchingStringsWithCache(np, [normalizedPath]).length > 0;
}

function isOutput(
  taskId: string,
  path: string,
  projectGraph: ProjectGraph
): boolean {
  const normalized = normalizePath(path);
  return getOutputs(taskId, projectGraph).some((p) =>
    pathMatchesPattern(normalized, p)
  );
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
  if (!taskGraph) return false;

  const { canonicalTaskId } = resolveIdentity(taskId, ctx.projectGraph);
  if (!taskGraph.tasks[canonicalTaskId]) return false;

  for (const { dependentTasksOutputFiles, transitive } of depsOutputs) {
    const glob = normalizePath(dependentTasksOutputFiles);
    if (getMatchingStringsWithCache(glob, [normalized]).length === 0) continue;
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

function isInput(taskId: string, path: string, ctx: LoadedContext): boolean {
  const normalized = normalizePath(path);
  const raw = getRawInputs(taskId, ctx);
  if (raw) {
    if (raw.files.includes(normalized)) return true;
    if (raw.depOutputs.includes(normalized)) return true;
  }
  return matchesDependentTaskOutputs(taskId, normalized, ctx);
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Check which files are legitimate inputs for the given task.
 *
 * A file is "matched" when it satisfies any of:
 *   - It appears in the task's declared input file list.
 *   - It appears in the task's materialized `depOutputs` (upstream has run).
 *   - It matches a `dependentTasksOutputFiles` glob declared on the task AND
 *     lies inside the declared outputs of an upstream task in the task graph
 *     (static check — works even when upstream tasks have not yet run).
 */
export async function checkFilesAreInputs(
  taskId: string,
  files: string[]
): Promise<{ matched: string[]; unmatched: string[] }> {
  const ctx = await getContext();
  // Validate taskId eagerly so callers always get an error for invalid IDs,
  // even when the file list is empty.
  resolveIdentity(taskId, ctx.projectGraph);
  const matched: string[] = [];
  const unmatched: string[] = [];
  for (const file of files) {
    if (isInput(taskId, file, ctx)) {
      matched.push(file);
    } else {
      unmatched.push(file);
    }
  }
  return { matched, unmatched };
}

/**
 * Check which files match any output glob declared for the given task.
 * Uses the same path-matching logic as the task runner (directory containment
 * + glob matching via minimatch).
 */
export async function checkFilesAreOutputs(
  taskId: string,
  files: string[]
): Promise<{ matched: string[]; unmatched: string[] }> {
  const ctx = await getContext();
  // Validate taskId eagerly so callers always get an error for invalid IDs,
  // even when the file list is empty.
  resolveIdentity(taskId, ctx.projectGraph);
  const matched: string[] = [];
  const unmatched: string[] = [];
  for (const file of files) {
    if (isOutput(taskId, file, ctx.projectGraph)) {
      matched.push(file);
    } else {
      unmatched.push(file);
    }
  }
  return { matched, unmatched };
}

// ── Internal helpers (not exported from devkit-exports) ──────────────────────

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

/**
 * Returns the resolved output patterns for a task (after token substitution).
 * Used internally by the `nx show target --outputs` renderer.
 */
export async function getTaskOutputPatterns(taskId: string): Promise<string[]> {
  const ctx = await getContext();
  return getOutputs(taskId, ctx.projectGraph);
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
