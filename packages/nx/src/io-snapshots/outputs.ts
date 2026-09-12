import type { ProjectGraph } from '../config/project-graph';
import type { TaskGraph } from '../config/task-graph';
import { ioSnapshotOutputs, type IoSnapshots } from '../native';
import { customHasherTaskIds, optedOutTaskIds } from './overrides';

/**
 * Observed outputs per task the bundle makes eligible (same walk as hashing),
 * already confined to the workspace and outside node_modules/.nx/.git.
 * Ineligible tasks are absent. Read-only; `nx show` labels these `snapshot`.
 */
export function observedIoSnapshotOutputs(
  projectGraph: ProjectGraph,
  taskGraph: TaskGraph,
  snapshots: IoSnapshots
): Record<string, string[]> {
  return ioSnapshotOutputs(
    snapshots,
    taskGraph,
    optedOutTaskIds(projectGraph, taskGraph),
    customHasherTaskIds(projectGraph, taskGraph),
    Object.fromEntries(
      Object.values(projectGraph.nodes).map((node) => [
        node.name,
        node.data.root,
      ])
    )
  );
}

/**
 * Extends each eligible task's outputs in place to `declared ∪ observed`,
 * declared first, deduplicated by exact string. Ineligible tasks keep their
 * declared outputs untouched. Idempotent. Runs before hashing so the task
 * graph the hasher, the cache, and the deferral check see carries the union.
 */
export function applyIoSnapshotOutputs(
  projectGraph: ProjectGraph,
  taskGraph: TaskGraph,
  snapshots: IoSnapshots
): { applied: string[]; observed: Record<string, string[]> } {
  const observed = observedIoSnapshotOutputs(
    projectGraph,
    taskGraph,
    snapshots
  );
  const applied: string[] = [];
  for (const [taskId, outputs] of Object.entries(observed)) {
    const task = taskGraph.tasks[taskId];
    if (!task) continue;
    const added = outputs.filter((output) => !task.outputs.includes(output));
    if (added.length) {
      task.outputs = [...task.outputs, ...added];
      applied.push(taskId);
    }
  }
  applied.sort();
  return { applied, observed };
}
