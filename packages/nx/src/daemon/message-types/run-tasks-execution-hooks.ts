import type {
  PostTasksExecutionContext,
  PreTasksExecutionContext,
} from '../../project-graph/plugins';

export const PRE_TASKS_EXECUTION = 'PRE_TASKS_EXECUTION' as const;
export const POST_TASKS_EXECUTION = 'POST_TASKS_EXECUTION' as const;

export type HandlePreTasksExecutionMessage = {
  type: typeof PRE_TASKS_EXECUTION;
  context: PreTasksExecutionContext;
};
export type HandlePostTasksExecutionMessage = {
  type: typeof POST_TASKS_EXECUTION;
  context: PostTasksExecutionContext;
};

export function isHandlePreTasksExecutionMessage(
  message: unknown
): message is HandlePreTasksExecutionMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === PRE_TASKS_EXECUTION
  );
}

export function isHandlePostTasksExecutionMessage(
  message: unknown
): message is HandlePostTasksExecutionMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === POST_TASKS_EXECUTION
  );
}
