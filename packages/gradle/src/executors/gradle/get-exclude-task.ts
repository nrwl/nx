import {
  ProjectGraphProjectNode,
  Target,
  TaskGraph,
  targetToTargetString,
} from '@nx/devkit';

/**
 * Resolves a dependsOn entry to a Target.
 * Handles both string format ("target") and object format
 * ({ target: "name", projects?: ["proj1"] }).
 * For same-project object deps (no projects field), uses the owning project name.
 */
function resolveDepToTarget(
  dep: string | { target?: string; projects?: string | string[] },
  owningProject: string
): Target | null {
  if (typeof dep === 'string') {
    return { project: owningProject, target: dep };
  }
  const target = dep?.target;
  if (!target) {
    return null;
  }
  if (dep.projects) {
    const projectList = Array.isArray(dep.projects)
      ? dep.projects
      : [dep.projects];
    return {
      project: projectList[0] !== 'self' ? projectList[0] : owningProject,
      target,
    };
  }
  return { project: owningProject, target };
}

/**
 * Project-graph-based exclude resolver for the single-task executor.
 *
 * Walks the full transitive dependsOn graph for each task so that
 * indirect dependencies (e.g. the deps of a direct dep's `jar`)
 * are also excluded, matching Gradle's own transitive task graph.
 *
 * For batch mode, prefer `getExcludeTasksFromTaskGraph` — it uses the
 * TaskGraph Nx has already computed, which reflects exactly what will
 * run and picks up cross-project implicit dependencies.
 *
 * @param tasks - Set of Target to process
 * @param nodes - Project graph nodes
 * @param runningTasks - Set of Target that are currently running (won't be excluded)
 * @param includeDependsOnTasks - Set of Gradle task names that should be included (not excluded)
 *   (typically provider-based dependencies that Gradle must resolve)
 */
export function getExcludeTasks(
  tasks: Set<Target>,
  nodes: Record<string, ProjectGraphProjectNode>,
  runningTasks: Set<Target> = new Set(),
  includeDependsOnTasks: Set<string> = new Set()
): Set<string> {
  const excludes = new Set<string>();
  const runningKeys = new Set(
    Array.from(runningTasks).map(targetToTargetString)
  );

  for (const task of tasks) {
    const transitiveDeps = getAllDependsOnFromProjectGraph(
      nodes,
      task.project,
      task.target
    );
    for (const depPt of transitiveDeps) {
      if (runningKeys.has(targetToTargetString(depPt))) {
        continue;
      }
      const gradleTaskName = getGradleTaskName(depPt, nodes);
      if (gradleTaskName && !includeDependsOnTasks.has(gradleTaskName)) {
        excludes.add(gradleTaskName);
      }
    }
  }

  return excludes;
}

export function getGradleTaskName(
  pt: Target,
  nodes: Record<string, ProjectGraphProjectNode>
): string | null {
  return nodes[pt.project]?.data?.targets?.[pt.target]?.options?.taskName;
}

function getAllDependsOnFromProjectGraph(
  nodes: Record<string, ProjectGraphProjectNode>,
  projectName: string,
  targetName: string
): Set<Target> {
  const seen = new Set<string>();
  const result = new Set<Target>();
  const startKey = targetToTargetString({
    project: projectName,
    target: targetName,
  });
  const stack: Target[] = [{ project: projectName, target: targetName }];

  while (stack.length > 0) {
    const current = stack.pop();
    const key = targetToTargetString(current);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    if (key !== startKey) {
      result.add(current);
    }

    const directDependencies =
      nodes[current.project]?.data?.targets?.[current.target]?.dependsOn ?? [];

    for (const dep of directDependencies) {
      const depPt = resolveDepToTarget(dep, current.project);
      if (depPt && !seen.has(targetToTargetString(depPt))) {
        stack.push(depPt);
      }
    }
  }

  return result;
}

/**
 * Task-graph-based exclude resolver for batch mode.
 *
 * Walks `taskGraph.dependencies` transitively from each starting task id.
 * Any reachable dependency task that is NOT in `runningTaskIds` has its
 * Gradle `taskName` (resolved from project graph nodes) added to the
 * excludes, unless it appears in `includeDependsOnTasks`.
 *
 * @param taskIdsToExcludeDepsOf - Task IDs whose dependsOn chain should be excluded
 * @param runningTaskIds - Task IDs that WILL run and therefore must not be excluded
 * @param taskGraph - The task graph for the current batch
 * @param nodes - Project graph nodes, used only to look up each task's `taskName`
 * @param includeDependsOnTasks - Gradle task names to never exclude (provider-based deps)
 */
export function getExcludeTasksFromTaskGraph(
  taskIdsToExcludeDepsOf: Iterable<string>,
  runningTaskIds: Set<string>,
  taskGraph: TaskGraph,
  nodes: Record<string, ProjectGraphProjectNode>,
  includeDependsOnTasks: Set<string> = new Set()
): Set<string> {
  const excludes = new Set<string>();
  const transitiveDepIds = getAllDependsOnFromTaskGraph(
    taskIdsToExcludeDepsOf,
    taskGraph
  );

  for (const depTaskId of transitiveDepIds) {
    if (runningTaskIds.has(depTaskId)) {
      continue;
    }
    const task = taskGraph.tasks[depTaskId];
    if (!task) {
      continue;
    }
    const gradleTaskName = getGradleTaskName(task.target, nodes);
    if (gradleTaskName && !includeDependsOnTasks.has(gradleTaskName)) {
      excludes.add(gradleTaskName);
    }
  }

  return excludes;
}

/**
 * Returns the transitive set of dependency task IDs reachable via
 * `taskGraph.dependencies` from the given starting IDs. The starting
 * IDs themselves are NOT included in the result. Cycle-safe.
 */
export function getAllDependsOnFromTaskGraph(
  startTaskIds: Iterable<string>,
  taskGraph: TaskGraph
): Set<string> {
  const result = new Set<string>();
  const seen = new Set<string>();
  const stack: string[] = [];

  for (const id of startTaskIds) {
    seen.add(id);
    for (const dep of taskGraph.dependencies[id] ?? []) {
      stack.push(dep);
    }
  }

  while (stack.length > 0) {
    const current = stack.pop();
    if (seen.has(current)) {
      continue;
    }
    seen.add(current);
    result.add(current);

    for (const dep of taskGraph.dependencies[current] ?? []) {
      if (!seen.has(dep)) {
        stack.push(dep);
      }
    }
  }

  return result;
}
