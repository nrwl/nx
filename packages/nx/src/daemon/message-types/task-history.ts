import type { TaskRun } from '../../native';

export const GET_FLAKY_TASKS = 'GET_FLAKY_TASKS' as const;

export type HandleGetFlakyTasks = {
  type: typeof GET_FLAKY_TASKS;
  hashes: string[];
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

export const RECORD_TASK_RUNS = 'RECORD_TASK_RUNS' as const;

export type HandleRecordTaskRunsMessage = {
  type: typeof RECORD_TASK_RUNS;
  taskRuns: TaskRun[];
};

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
