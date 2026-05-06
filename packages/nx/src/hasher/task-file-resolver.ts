import { minimatch } from 'minimatch';
import { type NxJsonConfiguration, readNxJson } from '../config/nx-json';
import type { ProjectGraph } from '../config/project-graph';
import type { Task, TaskGraph } from '../config/task-graph';
import type { HashInputs } from '../native';
import { createTaskGraph } from '../tasks-runner/create-task-graph';
import { getOutputsForTargetAndConfiguration } from '../tasks-runner/utils';
import { splitByColons } from '../utils/split-target';
import { workspaceRoot as defaultWorkspaceRoot } from '../utils/workspace-root';
import { HashPlanInspector } from './hash-plan-inspector';
import { type ExpandedDepsOutput, getInputs } from './task-hasher';

export interface TaskFileResolver {
  /** Full hash plan entry (files + runtime + environment + depOutputs + external). */
  getRawInputs(taskId: string): HashInputs | null;
  getInputs(taskId: string): string[];
  getOutputs(taskId: string): string[];
  isInput(taskId: string, path: string): boolean;
  isOutput(taskId: string, path: string): boolean;
  /**
   * True iff `path` matches a `dependentTasksOutputFiles` glob declared on the
   * task AND lies inside the declared outputs of an upstream task in the
   * task graph. Works without the upstream tasks having actually run, so
   * static path validation (e.g. sandbox-report verification) is supported.
   */
  matchesDependentTaskOutputs(taskId: string, path: string): boolean;
}

export async function createTaskFileResolver(options: {
  projectGraph: ProjectGraph;
  nxJson?: NxJsonConfiguration;
  workspaceRoot?: string;
}): Promise<TaskFileResolver> {
  const workspaceRoot = options.workspaceRoot ?? defaultWorkspaceRoot;
  let resolvedNxJson: NxJsonConfiguration | undefined = options.nxJson;
  function getNxJson(): NxJsonConfiguration {
    return (resolvedNxJson ??= readNxJson(workspaceRoot));
  }
  const inspector = new HashPlanInspector(
    options.projectGraph,
    workspaceRoot,
    options.nxJson
  );
  await inspector.init();

  // Cache the full HashInputs (null = task not found). A single cache entry
  // serves both getRawInputs() and getInputs() so the inspector is never
  // called more than once per taskId.
  const hashInputsCache = new Map<string, HashInputs | null>();
  const outputsCache = new Map<string, string[]>();
  const taskGraphCache = new Map<string, TaskGraph | null>();
  const depsOutputsCache = new Map<string, ExpandedDepsOutput[]>();

  function parseTaskId(taskId: string): {
    project: string;
    target: string;
    configuration?: string;
  } {
    const [project, target, configuration] = splitByColons(taskId);
    if (!project || !target) {
      throw new Error(
        `Invalid taskId "${taskId}" — expected "project:target[:configuration]"`
      );
    }
    return { project, target, configuration };
  }

  function getRawInputs(taskId: string): HashInputs | null {
    if (hashInputsCache.has(taskId)) {
      return hashInputsCache.get(taskId) ?? null;
    }

    const { project, target, configuration } = parseTaskId(taskId);

    let planResult: Record<string, HashInputs> = {};
    try {
      planResult = inspector.inspectTaskInputs({
        project,
        target,
        configuration,
      });
    } catch {
      // Project / target not found in graph — treat as no inputs.
      hashInputsCache.set(taskId, null);
      return null;
    }

    // The result key is usually the same as taskId but may include a
    // defaultConfiguration suffix when none was explicitly given.
    let inputs: HashInputs | undefined = planResult[taskId];
    if (!inputs) {
      const prefix = `${project}:${target}`;
      for (const [key, val] of Object.entries(planResult)) {
        if (key === prefix || key.startsWith(prefix + ':')) {
          inputs = val;
          break;
        }
      }
    }

    const result = inputs ?? null;
    hashInputsCache.set(taskId, result);
    return result;
  }

  function getInputsImpl(taskId: string): string[] {
    return getRawInputs(taskId)?.files ?? [];
  }

  function getOutputs(taskId: string): string[] {
    const cached = outputsCache.get(taskId);
    if (cached !== undefined) return cached;

    const { project, target, configuration } = parseTaskId(taskId);
    const node = options.projectGraph.nodes[project];
    const outputs = node?.data?.targets?.[target]
      ? getOutputsForTargetAndConfiguration(
          { project, target, configuration },
          {},
          node
        )
      : [];

    outputsCache.set(taskId, outputs);
    return outputs;
  }

  function getTaskGraphFor(taskId: string): TaskGraph | null {
    if (taskGraphCache.has(taskId)) return taskGraphCache.get(taskId) ?? null;
    const { project, target, configuration } = parseTaskId(taskId);
    if (!options.projectGraph.nodes[project]) {
      taskGraphCache.set(taskId, null);
      return null;
    }
    let tg: TaskGraph | null = null;
    try {
      tg = createTaskGraph(
        options.projectGraph,
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

  function findCanonicalTaskId(taskId: string, tg: TaskGraph): string | null {
    if (tg.tasks[taskId]) return taskId;
    const { project, target } = parseTaskId(taskId);
    const prefix = `${project}:${target}`;
    for (const id of Object.keys(tg.tasks)) {
      if (id === prefix || id.startsWith(prefix + ':')) return id;
    }
    return null;
  }

  function getDepsOutputs(taskId: string): ExpandedDepsOutput[] {
    if (depsOutputsCache.has(taskId)) return depsOutputsCache.get(taskId)!;

    const tg = getTaskGraphFor(taskId);
    if (!tg) {
      depsOutputsCache.set(taskId, []);
      return [];
    }
    const canonical = findCanonicalTaskId(taskId, tg);
    if (!canonical) {
      depsOutputsCache.set(taskId, []);
      return [];
    }
    const task = tg.tasks[canonical] as Task;
    let result: ExpandedDepsOutput[] = [];
    try {
      result =
        getInputs(task, options.projectGraph, getNxJson()).depsOutputs ?? [];
    } catch {
      result = [];
    }
    depsOutputsCache.set(taskId, result);
    return result;
  }

  function getUpstreamTaskIds(taskId: string, transitive: boolean): string[] {
    const tg = getTaskGraphFor(taskId);
    if (!tg) return [];
    const canonical = findCanonicalTaskId(taskId, tg);
    if (!canonical) return [];
    const direct = tg.dependencies[canonical] ?? [];
    if (!transitive) return [...direct];
    const visited = new Set<string>();
    const queue = [...direct];
    while (queue.length) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      queue.push(...(tg.dependencies[id] ?? []));
    }
    return [...visited];
  }

  function pathMatchesOutputPattern(
    normalizedPath: string,
    pattern: string
  ): boolean {
    const np = pattern.replace(/\\/g, '/');
    return (
      normalizedPath === np ||
      normalizedPath.startsWith(np + '/') ||
      minimatch(normalizedPath, np, { dot: true })
    );
  }

  function isOutputImpl(taskId: string, path: string): boolean {
    const normalized = path.replace(/\\/g, '/');
    return getOutputs(taskId).some((p) =>
      pathMatchesOutputPattern(normalized, p)
    );
  }

  function matchesDependentTaskOutputs(taskId: string, path: string): boolean {
    const normalized = path.replace(/\\/g, '/');
    const depsOutputs = getDepsOutputs(taskId);
    if (depsOutputs.length === 0) return false;
    for (const { dependentTasksOutputFiles, transitive } of depsOutputs) {
      if (!minimatch(normalized, dependentTasksOutputFiles, { dot: true })) {
        continue;
      }
      const upstreamIds = getUpstreamTaskIds(taskId, !!transitive);
      for (const upstreamId of upstreamIds) {
        if (isOutputImpl(upstreamId, normalized)) return true;
      }
    }
    return false;
  }

  return {
    getRawInputs,
    getInputs: getInputsImpl,
    getOutputs,
    matchesDependentTaskOutputs,
    isInput(taskId: string, path: string): boolean {
      const normalized = path.replace(/\\/g, '/');
      const raw = getRawInputs(taskId);
      if (raw) {
        if (raw.files.includes(path) || raw.files.includes(normalized)) {
          return true;
        }
        if (
          raw.depOutputs.includes(path) ||
          raw.depOutputs.includes(normalized)
        ) {
          return true;
        }
      }
      return matchesDependentTaskOutputs(taskId, normalized);
    },
    isOutput: isOutputImpl,
  };
}
