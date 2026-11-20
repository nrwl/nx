import type { Task } from '../config/task-graph';

/**
 * Slots a task occupies out of `parallel`. Capped at `parallel` so a task
 * heavier than the whole budget still runs, but only once nothing else does.
 */
export function getTaskWeight(task: Task, parallel: number): number {
  const weight =
    Number.isInteger(task.weight) && task.weight > 0 ? task.weight : 1;
  return Math.min(weight, Math.max(1, parallel));
}
