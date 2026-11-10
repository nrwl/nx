import type { Task, TaskGraph } from '../config/task-graph';

/**
 * Everything written onto a task as a run progresses: hashes and hash
 * details by the hasher, timings by the orchestrator, terminal output by the
 * Nx Cloud life cycle. Nothing that receives a task graph over a socket or
 * a fork needs any of it. The daemon recomputes hashes, and a worker learns
 * its own from `NX_TASK_HASH`; hash details are read only by Nx Cloud on the
 * runner side.
 */
export const TASK_RESULT_FIELDS = [
  'hash',
  'hashDetails',
  'startTime',
  'endTime',
  'terminalOutput',
] as const;

const prunedGraphs = new WeakMap<TaskGraph, TaskGraph>();

/**
 * A copy of the graph with `TASK_RESULT_FIELDS` removed from every task, made
 * once per graph object. Structure and the remaining fields are fixed once a
 * graph is built and only result fields change during a run, so the copy
 * never goes stale, and the source graph is untouched.
 */
export function pruneTaskGraph(taskGraph: TaskGraph): TaskGraph {
  let pruned = prunedGraphs.get(taskGraph);
  if (pruned) return pruned;
  const tasks: Record<string, Task> = {};
  for (const id in taskGraph.tasks) {
    const task = taskGraph.tasks[id];
    const copy = {} as Task;
    for (const key in task) {
      if (!(TASK_RESULT_FIELDS as readonly string[]).includes(key)) {
        (copy as any)[key] = (task as any)[key];
      }
    }
    tasks[id] = copy;
  }
  pruned = { ...taskGraph, tasks };
  prunedGraphs.set(taskGraph, pruned);
  return pruned;
}
