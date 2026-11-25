import type { Task } from '../config/task-graph';
import { hashTaskOverrides } from './utils';

/**
 * A task whose command started a nested Nx process. Nested processes inherit
 * the list through `NX_INVOCATION_ANCESTORS`, outermost first.
 */
export interface InvocationAncestor {
  taskId: string;
  overridesHash: string;
}

// `app:build -> app:build --flag` is a legitimate chain that stops after one
// hop. A task already running in two ancestors has arguments that keep
// changing, so it is treated as a loop too.
const MAX_ANCESTOR_INVOCATIONS_PER_TASK = 2;

export function getInvocationAncestors(): InvocationAncestor[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(process.env.NX_INVOCATION_ANCESTORS ?? '[]');
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (ancestor): ancestor is InvocationAncestor =>
      typeof ancestor?.taskId === 'string' &&
      typeof ancestor.overridesHash === 'string'
  );
}

/**
 * The value of `NX_INVOCATION_ANCESTORS` for a child process that runs
 * `tasks`. A batch worker runs several tasks under one env, so each of them
 * counts as an ancestor of any Nx process it starts.
 */
export function serializeInvocationAncestors(tasks: Task[]): string {
  const ancestors: InvocationAncestor[] = [
    ...getInvocationAncestors(),
    ...tasks.map((task) => ({
      taskId: task.id,
      overridesHash: hashTaskOverrides(task),
    })),
  ];
  return JSON.stringify(ancestors);
}

/**
 * Returns the ancestor task ids when running `task` would re-enter one of its
 * own ancestor tasks, or `null` when it would not.
 */
export function findInvocationLoop(
  task: Task,
  ancestors: InvocationAncestor[]
): string[] | null {
  const ancestorsRunningTask = ancestors.filter((a) => a.taskId === task.id);
  if (ancestorsRunningTask.length === 0) return null;

  const overridesHash = hashTaskOverrides(task);
  const isLoop =
    ancestorsRunningTask.some((a) => a.overridesHash === overridesHash) ||
    ancestorsRunningTask.length >= MAX_ANCESTOR_INVOCATIONS_PER_TASK;
  return isLoop ? ancestors.map((a) => a.taskId) : null;
}
