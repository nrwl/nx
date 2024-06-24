import { TaskRun } from '../../utils/task-history';

export const GET_TASK_HISTORY_FOR_HASHES =
  'GET_TASK_HISTORY_FOR_HASHES' as const;

export type HandleGetTaskHistoryForHashesMessage = {
  type: typeof GET_TASK_HISTORY_FOR_HASHES;
  hashes: string[];
};

export function isHandleGetTaskHistoryForHashesMessage(
  message: unknown
): message is HandleGetTaskHistoryForHashesMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === GET_TASK_HISTORY_FOR_HASHES
  );
}

export const WRITE_TASK_RUNS_TO_HISTORY = 'WRITE_TASK_RUNS_TO_HISTORY' as const;

export type HandleWriteTaskRunsToHistoryMessage = {
  type: typeof WRITE_TASK_RUNS_TO_HISTORY;
  taskRuns: TaskRun[];
};

export function isHandleWriteTaskRunsToHistoryMessage(
  message: unknown
): message is HandleWriteTaskRunsToHistoryMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === WRITE_TASK_RUNS_TO_HISTORY
  );
}
