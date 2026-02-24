export const REGISTER_RUNNING_TASKS = 'REGISTER_RUNNING_TASKS' as const;
export const UPDATE_RUNNING_TASKS = 'UPDATE_RUNNING_TASKS' as const;
export const UNREGISTER_RUNNING_TASKS = 'UNREGISTER_RUNNING_TASKS' as const;
export const GET_RUNNING_TASKS = 'GET_RUNNING_TASKS' as const;
export const GET_RUNNING_TASK_OUTPUT = 'GET_RUNNING_TASK_OUTPUT' as const;

export interface RunningTaskStatusUpdate {
  id: string;
  status: string;
  continuous?: boolean;
  startTime?: string;
  endTime?: string;
}

export type HandleRegisterRunningTasksMessage = {
  type: typeof REGISTER_RUNNING_TASKS;
  pid: number;
  command: string;
  taskIds: string[];
};

export type HandleUpdateRunningTasksMessage = {
  type: typeof UPDATE_RUNNING_TASKS;
  pid: number;
  taskUpdates: RunningTaskStatusUpdate[];
  outputChunks: Record<string, string>;
};

export type HandleUnregisterRunningTasksMessage = {
  type: typeof UNREGISTER_RUNNING_TASKS;
  pid: number;
};

export type HandleGetRunningTasksMessage = {
  type: typeof GET_RUNNING_TASKS;
};

export type HandleGetRunningTaskOutputMessage = {
  type: typeof GET_RUNNING_TASK_OUTPUT;
  pid: number;
  taskId: string;
};

export function isHandleRegisterRunningTasksMessage(
  message: unknown
): message is HandleRegisterRunningTasksMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === REGISTER_RUNNING_TASKS
  );
}

export function isHandleUpdateRunningTasksMessage(
  message: unknown
): message is HandleUpdateRunningTasksMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === UPDATE_RUNNING_TASKS
  );
}

export function isHandleUnregisterRunningTasksMessage(
  message: unknown
): message is HandleUnregisterRunningTasksMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === UNREGISTER_RUNNING_TASKS
  );
}

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

export function isHandleGetRunningTaskOutputMessage(
  message: unknown
): message is HandleGetRunningTaskOutputMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === GET_RUNNING_TASK_OUTPUT
  );
}
