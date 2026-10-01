import type { ProjectGraph } from '../config/project-graph';
import type { TaskGraph } from '../config/task-graph';
import {
  getUltracacheReport,
  type UltracacheEligibilityOptions,
  type UltracacheReport,
  type UltracacheConfiguration,
  type TaskUltracacheSettings,
} from '../native';
import { readProjectsConfigurationFromProjectGraph } from '../project-graph/project-graph';
import { getExecutorForTask } from '../tasks-runner/utils';

const customHasherMemo = new WeakMap<TaskGraph, string[]>();

/**
 * Tasks whose executor ships a custom hasher; they are never hashed from a
 * snapshot. Detected here because executors are resolved in JS, by the
 * factory's presence only — invoking it would load user modules.
 */
function customHasherTaskIds(
  projectGraph: ProjectGraph,
  taskGraph: TaskGraph
): string[] {
  const memoized = customHasherMemo.get(taskGraph);
  if (memoized) {
    return memoized;
  }
  const projects =
    readProjectsConfigurationFromProjectGraph(projectGraph).projects;
  const ids = Object.values(taskGraph.tasks)
    .filter((task) => {
      try {
        return !!getExecutorForTask(task, projects).hasherFactory;
      } catch {
        // An unresolvable executor fails later, at execution; it is not a
        // reason to withhold a snapshot here.
        return false;
      }
    })
    .map((task) => task.id);
  customHasherMemo.set(taskGraph, ids);
  return ids;
}

/**
 * Each task's ultracache configuration: all the native eligibility walk reads
 * from a task. `null`, not `undefined`: the native map drops `undefined` keys.
 */
export function getUltracacheSettings(
  taskGraph: TaskGraph
): Record<string, TaskUltracacheSettings | null> {
  return Object.fromEntries(
    Object.entries(taskGraph.tasks).map(([id, task]) => [
      id,
      task.ultracache ?? null,
    ])
  );
}

/** The eligibility walk's view of the run's tasks, as JS resolves it. */
export function ultracacheEligibilityOptions(
  projectGraph: ProjectGraph,
  taskGraph: TaskGraph
): UltracacheEligibilityOptions {
  return {
    customHasherTaskIds: customHasherTaskIds(projectGraph, taskGraph),
  };
}

/**
 * Reports which tasks in `taskGraph` hash from `snapshots` and why the rest
 * do not, with the same eligibility walk the planner uses, without building a
 * planner (no project-graph transfer). Never fetches, never throws. Feeds
 * the `--verbose` run summary.
 */
export function buildUltracacheOverrides(
  projectGraph: ProjectGraph,
  taskGraph: TaskGraph,
  snapshots: UltracacheConfiguration
): UltracacheReport {
  return getUltracacheReport(
    snapshots,
    getUltracacheSettings(taskGraph),
    ultracacheEligibilityOptions(projectGraph, taskGraph)
  );
}
