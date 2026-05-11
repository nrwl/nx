import { minimatch } from 'minimatch';
import { type NxJsonConfiguration, readNxJson } from '../config/nx-json';
import type { ProjectGraph } from '../config/project-graph';
import type { Task, TaskGraph } from '../config/task-graph';
import type { HashInputs } from '../native';
import { createTaskGraph } from '../tasks-runner/create-task-graph';
import {
  createTaskId,
  getOutputsForTargetAndConfiguration,
} from '../tasks-runner/utils';
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

    // When no configuration was specified, the inspector may key the result
    // under the target's defaultConfiguration. Use createTaskId with
    // defaultConfiguration to build the expected key directly.
    const defaultConfig =
      options.projectGraph.nodes[project]?.data?.targets?.[target]
        ?.defaultConfiguration;
    const canonicalId = createTaskId(
      project,
      target,
      configuration ?? defaultConfig
    );
    const result =
      planResult[canonicalId] ??
      planResult[createTaskId(project, target, undefined)] ??
      null;
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
    const targetData = node?.data?.targets?.[target];
    // Fall back to the target's defaultConfiguration when none was specified so
    // configuration-specific output interpolations are resolved correctly.
    const effectiveConfig = configuration ?? targetData?.defaultConfiguration;
    const outputs = targetData
      ? getOutputsForTargetAndConfiguration(
          { project, target, configuration: effectiveConfig },
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
    const defaultConfig =
      options.projectGraph.nodes[project]?.data?.targets?.[target]
        ?.defaultConfiguration;
    if (defaultConfig) {
      const withDefault = createTaskId(project, target, defaultConfig);
      if (tg.tasks[withDefault]) return withDefault;
    }
    return null;
  }

  function getDepsOutputs(taskId: string): ExpandedDepsOutput[] {
    if (depsOutputsCache.has(taskId)) return depsOutputsCache.get(taskId)!;

    const { project, target } = parseTaskId(taskId);
    const node = options.projectGraph.nodes[project];
    if (!node?.data?.targets?.[target]) {
      depsOutputsCache.set(taskId, []);
      return [];
    }

    // getInputs only reads task.target.project and task.target.target, so we
    // don't need to build a full TaskGraph to obtain the Task object.
    let result: ExpandedDepsOutput[] = [];
    try {
      result =
        getInputs(
          { target: { project, target } } as Task,
          options.projectGraph,
          getNxJson()
        ).depsOutputs ?? [];
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
    if (!transitive) return [...(tg.dependencies[canonical] ?? [])];
    // BFS over the task graph to collect all transitive upstream task IDs.
    const visited = new Set<string>();
    const queue = [...(tg.dependencies[canonical] ?? [])];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      queue.push(...(tg.dependencies[id] ?? []));
    }
    return [...visited];
  }

  // No dedicated cross-codebase utility exists for matching a path against an
  // output pattern (exact, directory-prefix, or glob). The native expandOutputs
  // requires files to already exist on disk, which precludes static analysis.
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

  function isOutput(taskId: string, path: string): boolean {
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
        if (isOutput(upstreamId, normalized)) return true;
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
    isOutput,
  };
}
