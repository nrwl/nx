import type { ProjectGraph } from '../config/project-graph';
import type { TaskGraph } from '../config/task-graph';
import { getObservedIoSnapshotOutputs, type IoSnapshots } from '../native';
import { ioSnapshotEligibilityOptions } from './overrides';

/** The sets already applied to each task graph object. */
const applied = new WeakMap<TaskGraph, WeakSet<IoSnapshots>>();

/**
 * Extends each eligible task's outputs in place to `declared ∪ observed`,
 * declared first, as a set of exact strings. Ineligible tasks keep their
 * declared outputs untouched. Idempotent. Runs before hashing so the task
 * graph the hasher, the cache, and the deferral check see carries the union.
 * A graph already extended from `snapshots` is skipped: DTE workers pass the
 * same graph for every task they run.
 */
export function applyIoSnapshotOutputs(
  projectGraph: ProjectGraph,
  taskGraph: TaskGraph,
  snapshots: IoSnapshots
): void {
  if (applied.get(taskGraph)?.has(snapshots)) {
    return;
  }
  // Same walk as hashing, already confined to the workspace and outside
  // node_modules/.nx/.git; ineligible tasks are absent.
  const observed = getObservedIoSnapshotOutputs(
    snapshots,
    taskGraph,
    ioSnapshotEligibilityOptions(projectGraph, taskGraph)
  );
  for (const [taskId, outputs] of Object.entries(observed)) {
    const task = taskGraph.tasks[taskId];
    if (task) {
      task.outputs = [...new Set([...task.outputs, ...outputs])];
    }
  }
  // Marked only once applied, so a call that threw is retried.
  const sets = applied.get(taskGraph) ?? new WeakSet<IoSnapshots>();
  sets.add(snapshots);
  applied.set(taskGraph, sets);
}
