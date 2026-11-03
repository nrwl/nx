import type { Task } from '../config/task-graph';
import { signalToCode } from '../utils/exit-codes';
import type { TaskResults } from './life-cycle';
import type { TaskStatus } from './tasks-runner';

/**
 * Whether the run got to the end, as opposed to being interrupted.
 *
 * A discrete task skipped because a dependency failed has no `TaskResult`,
 * but the runner still settled it, so it must not make the run look
 * interrupted.
 */
export function didCommandComplete(
  tasks: Task[],
  taskResults: TaskResults,
  taskStatuses?: Record<string, TaskStatus>
): boolean {
  if (tasks.length === 0) return true;

  for (const task of tasks) {
    if (!task.continuous) {
      // Discrete task must have been settled by the runner
      if (!taskResults[task.id] && !taskStatuses?.[task.id]) return false;
    }
  }

  // Any stopped task means the run was interrupted
  return (
    !Object.values(taskResults).some((r) => r.status === 'stopped') &&
    !Object.values(taskStatuses ?? {}).some((s) => s === 'stopped')
  );
}

/**
 * Exit code for a run: 130 (SIGINT) when it was interrupted, 1 when any task
 * failed or was skipped, 0 otherwise.
 */
export function getRunExitCode(
  completed: boolean,
  taskResults: TaskResults,
  taskStatuses?: Record<string, TaskStatus>
): number {
  if (!completed) return signalToCode('SIGINT');
  const failedOrSkipped = (status: TaskStatus) =>
    status === 'failure' || status === 'skipped';
  return Object.values(taskResults).some((r) => failedOrSkipped(r.status)) ||
    Object.values(taskStatuses ?? {}).some(failedOrSkipped)
    ? 1
    : 0;
}
