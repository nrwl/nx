import { type NxJsonConfiguration, readNxJson } from '../config/nx-json';
import type {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../config/project-graph';
import type { ExternalObject, HashInputs, HashInstruction } from '../native';
import { createProjectGraphAsync } from '../project-graph/project-graph';
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

type PlansReference = ExternalObject<Record<string, Array<HashInstruction>>>;

const identityCache = new Map<string, TaskIdentity>();
const plansReferenceCache = new Map<string, PlansReference | null>();
const hashInputsCache = new Map<string, HashInputs | null>();
const outputsCache = new Map<string, string[]>();

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

/**
 * Builds the native hash plan for a task (and its dependency subtree) exactly
 * once per taskId and caches the opaque reference. Both the structured-inputs
 * lookup and the dependent-task-output matching derive from this single plan,
 * so the (relatively expensive) plan is never rebuilt per file. Returns null
 * when the plan cannot be built (e.g. the task graph fails to construct).
 */
function getPlansReference(
  taskId: string,
  { projectGraph, inspector }: LoadedContext
): PlansReference | null {
  if (plansReferenceCache.has(taskId)) {
    return plansReferenceCache.get(taskId) ?? null;
  }

  const { project, target, configuration } = resolveIdentity(
    taskId,
    projectGraph
  );

  let reference: PlansReference | null = null;
  try {
    reference = inspector.getPlansReferenceForTask({
      project,
      target,
      configuration,
    });
  } catch {
    reference = null;
  }
  plansReferenceCache.set(taskId, reference);
  return reference;
}

function getRawInputs(taskId: string, ctx: LoadedContext): HashInputs | null {
  if (hashInputsCache.has(taskId)) {
    return hashInputsCache.get(taskId) ?? null;
  }

  const { canonicalTaskId } = resolveIdentity(taskId, ctx.projectGraph);
  const reference = getPlansReference(taskId, ctx);

  let result: HashInputs | null = null;
  if (reference) {
    try {
      result =
        ctx.inspector.inspectInputsFromPlan(reference)[canonicalTaskId] ?? null;
    } catch {
      result = null;
    }
  }

  hashInputsCache.set(taskId, result);
  return result;
}

/**
 * Returns the subset of `normalizedFiles` that are covered by the task's
 * `dependentTasksOutputFiles` inputs. The dependency-graph walk and output-glob
 * matching are done natively (see `HashPlanInspector.checkDependentTaskOutputFiles`),
 * which performs a static, disk-free check — so files match even when the
 * upstream tasks have not produced their outputs yet.
 */
function getDependentTaskOutputMatches(
  taskId: string,
  normalizedFiles: string[],
  ctx: LoadedContext
): Set<string> {
  if (normalizedFiles.length === 0) return new Set();

  const reference = getPlansReference(taskId, ctx);
  if (!reference) return new Set();

  const { canonicalTaskId } = resolveIdentity(taskId, ctx.projectGraph);
  try {
    const matches = ctx.inspector.checkDependentTaskOutputFiles(
      reference,
      normalizedFiles
    );
    return new Set(matches[canonicalTaskId] ?? []);
  } catch {
    return new Set();
  }
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

  const raw = getRawInputs(taskId, ctx);
  const inputFiles = new Set(raw?.files ?? []);
  const depOutputs = new Set(raw?.depOutputs ?? []);

  const normalizedFiles = files.map(normalizePath);
  const dependentMatches = getDependentTaskOutputMatches(
    taskId,
    normalizedFiles,
    ctx
  );

  const matched: string[] = [];
  const unmatched: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const normalized = normalizedFiles[i];
    if (
      inputFiles.has(normalized) ||
      depOutputs.has(normalized) ||
      dependentMatches.has(normalized)
    ) {
      matched.push(files[i]);
    } else {
      unmatched.push(files[i]);
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
  plansReferenceCache.clear();
  hashInputsCache.clear();
  outputsCache.clear();
}
