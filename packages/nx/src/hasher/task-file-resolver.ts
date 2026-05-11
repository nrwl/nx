import { type NxJsonConfiguration, readNxJson } from '../config/nx-json';
import type {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../config/project-graph';
import type { Task, TaskGraph } from '../config/task-graph';
import type { HashInputs } from '../native';
import { createTaskGraph } from '../tasks-runner/create-task-graph';
import {
  createTaskId,
  getOutputsForTargetAndConfiguration,
} from '../tasks-runner/utils';
import { getMatchingStringsWithCache } from '../utils/find-matching-projects';
import { projectHasTargetAndConfiguration } from '../utils/project-graph-utils';
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

interface TaskIdentity {
  project: string;
  target: string;
  configuration: string | undefined;
  canonicalTaskId: string;
  projectNode: ProjectGraphProjectNode | undefined;
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

  const identityCache = new Map<string, TaskIdentity>();
  // A single hashInputsCache entry (null = task not found) serves both
  // getRawInputs() and getInputs() so the inspector is never called more
  // than once per taskId.
  const hashInputsCache = new Map<string, HashInputs | null>();
  const outputsCache = new Map<string, string[]>();
  const taskGraphCache = new Map<string, TaskGraph | null>();
  const depsOutputsCache = new Map<string, ExpandedDepsOutput[]>();

  /**
   * Parse the raw taskId and resolve the canonical form, mirroring the
   * `resolveConfiguration` logic in create-task-graph.ts: if no configuration
   * is provided (or the requested one is unknown), fall back to the target's
   * `defaultConfiguration`.
   */
  function resolveIdentity(taskId: string): TaskIdentity {
    const cached = identityCache.get(taskId);
    if (cached) return cached;

    const [project, target, configuration] = splitByColons(taskId);
    if (!project || !target) {
      throw new Error(
        `Invalid taskId "${taskId}" — expected "project:target[:configuration]"`
      );
    }

    const projectNode = options.projectGraph.nodes[project];
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

  function getRawInputs(taskId: string): HashInputs | null {
    if (hashInputsCache.has(taskId)) {
      return hashInputsCache.get(taskId) ?? null;
    }

    const { project, target, configuration, canonicalTaskId } =
      resolveIdentity(taskId);

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

    const result = planResult[canonicalTaskId] ?? null;
    hashInputsCache.set(taskId, result);
    return result;
  }

  function getOutputs(taskId: string): string[] {
    const cached = outputsCache.get(taskId);
    if (cached !== undefined) return cached;

    const { project, target, configuration, projectNode } =
      resolveIdentity(taskId);
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

  function getTaskGraphFor(taskId: string): TaskGraph | null {
    if (taskGraphCache.has(taskId)) return taskGraphCache.get(taskId) ?? null;
    const { project, target, configuration, projectNode } =
      resolveIdentity(taskId);
    if (!projectNode) {
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

  function getDepsOutputs(taskId: string): ExpandedDepsOutput[] {
    if (depsOutputsCache.has(taskId)) return depsOutputsCache.get(taskId)!;

    const { project, target, projectNode } = resolveIdentity(taskId);
    if (!projectNode?.data?.targets?.[target]) {
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
   * True if `path` is covered by `pattern`. Three cases:
   *   1. Directory containment — `pattern` is a literal path and `path` lives
   *      inside it (e.g. pattern `dist/libs/foo`, path `dist/libs/foo/x.js`).
   *   2. Exact / glob match via cached minimatch regex (getMatchingStringsWithCache).
   *
   * Note: the native `expandOutputs` helper requires files to exist on disk,
   * which precludes static analysis — so we match patterns directly here.
   */
  function pathMatchesPattern(
    normalizedPath: string,
    pattern: string
  ): boolean {
    const np = pattern.replace(/\\/g, '/');
    if (normalizedPath.startsWith(np + '/')) return true;
    return getMatchingStringsWithCache(np, [normalizedPath]).length > 0;
  }

  function isOutput(taskId: string, path: string): boolean {
    const normalized = path.replace(/\\/g, '/');
    return getOutputs(taskId).some((p) => pathMatchesPattern(normalized, p));
  }

  function matchesDependentTaskOutputs(taskId: string, path: string): boolean {
    const normalized = path.replace(/\\/g, '/');
    const depsOutputs = getDepsOutputs(taskId);
    if (depsOutputs.length === 0) return false;

    const taskGraph = getTaskGraphFor(taskId);
    if (!taskGraph) return false;
    const { canonicalTaskId } = resolveIdentity(taskId);
    if (!taskGraph.tasks[canonicalTaskId]) return false;

    for (const { dependentTasksOutputFiles, transitive } of depsOutputs) {
      const glob = dependentTasksOutputFiles.replace(/\\/g, '/');
      if (getMatchingStringsWithCache(glob, [normalized]).length === 0) {
        continue;
      }
      const upstreamIds = collectUpstreamTaskIds(
        taskGraph,
        canonicalTaskId,
        !!transitive
      );
      for (const upstreamId of upstreamIds) {
        if (isOutput(upstreamId, normalized)) return true;
      }
    }
    return false;
  }

  return {
    getRawInputs,
    getInputs(taskId: string): string[] {
      return getRawInputs(taskId)?.files ?? [];
    },
    getOutputs,
    isOutput,
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
  };
}
