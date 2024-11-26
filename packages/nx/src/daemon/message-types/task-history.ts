import type { TaskRun, TaskTarget } from '../../native';

export const GET_FLAKY_TASKS = 'GET_FLAKY_TASKS' as const;
export const GET_ESTIMATED_TASK_TIMINGS = 'GET_ESTIMATED_TASK_TIMINGS' as const;
export const RECORD_TASK_RUNS = 'RECORD_TASK_RUNS' as const;

export type HandleGetFlakyTasks = {
  type: typeof GET_FLAKY_TASKS;
  hashes: string[];
};

export type HandleGetEstimatedTaskTimings = {
  type: typeof GET_ESTIMATED_TASK_TIMINGS;
  targets: TaskTarget[];
};

export type HandleRecordTaskRunsMessage = {
  type: typeof RECORD_TASK_RUNS;
  taskRuns: TaskRun[];
};

export function isHandleGetFlakyTasksMessage(
  message: unknown
): message is HandleGetFlakyTasks {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === GET_FLAKY_TASKS
  );
}

export function isHandleGetEstimatedTaskTimings(
  message: unknown
): message is HandleGetEstimatedTaskTimings {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === GET_ESTIMATED_TASK_TIMINGS
  );
}

export function isHandleWriteTaskRunsToHistoryMessage(
  message: unknown
): message is HandleRecordTaskRunsMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === RECORD_TASK_RUNS
  );
}
