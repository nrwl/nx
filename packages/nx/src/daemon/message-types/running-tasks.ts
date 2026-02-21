export const GET_RUNNING_TASKS = 'GET_RUNNING_TASKS' as const;
export const ADD_RUNNING_TASK = 'ADD_RUNNING_TASK' as const;
export const REMOVE_RUNNING_TASK = 'REMOVE_RUNNING_TASK' as const;

export type HandleGetRunningTasksMessage = {
  type: typeof GET_RUNNING_TASKS;
  ids: string[];
};

export type HandleAddRunningTaskMessage = {
  type: typeof ADD_RUNNING_TASK;
  taskId: string;
};

export type HandleRemoveRunningTaskMessage = {
  type: typeof REMOVE_RUNNING_TASK;
  taskId: string;
};

export function isHandleGetRunningTasksMessage(
  message: unknown
): message is HandleGetRunningTasksMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === GET_RUNNING_TASKS
  );
}

export function isHandleAddRunningTaskMessage(
  message: unknown
): message is HandleAddRunningTaskMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === ADD_RUNNING_TASK
  );
}

export function isHandleRemoveRunningTaskMessage(
  message: unknown
): message is HandleRemoveRunningTaskMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === REMOVE_RUNNING_TASK
  );
}
