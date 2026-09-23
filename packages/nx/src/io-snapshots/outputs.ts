import type { ProjectGraph } from '../config/project-graph';
import type { TaskGraph } from '../config/task-graph';
import { getObservedIoSnapshotOutputs, type IoSnapshots } from '../native';
import { ioSnapshotEligibilityOptions } from './overrides';

/**
 * Extends each eligible task's outputs in place to `declared ∪ observed`,
 * declared first, as a set of exact strings. Ineligible tasks keep their
 * declared outputs untouched. Idempotent. Runs before hashing so the task
 * graph the hasher, the cache, and the deferral check see carries the union.
 */
export function applyIoSnapshotOutputs(
  projectGraph: ProjectGraph,
  taskGraph: TaskGraph,
  snapshots: IoSnapshots
): { applied: string[]; observed: Record<string, string[]> } {
  // Same walk as hashing, already confined to the workspace and outside
  // node_modules/.nx/.git; ineligible tasks are absent.
  const observed = getObservedIoSnapshotOutputs(
    snapshots,
    taskGraph,
    ioSnapshotEligibilityOptions(projectGraph, taskGraph)
  );
  const applied: string[] = [];
  for (const [taskId, outputs] of Object.entries(observed)) {
    const task = taskGraph.tasks[taskId];
    if (!task) continue;
    const merged = [...new Set([...task.outputs, ...outputs])];
    const changed =
      merged.length !== task.outputs.length ||
      merged.some((output, i) => output !== task.outputs[i]);
    if (changed) {
      task.outputs = merged;
      applied.push(taskId);
    }
  }
  applied.sort();
  return { applied, observed };
}
