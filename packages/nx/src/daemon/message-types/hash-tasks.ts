import { Task, TaskGraph } from '../../config/task-graph';
import { Message } from '../client/daemon-socket-messenger';

export const HASH_TASKS = 'HASH_TASKS' as const;

export type HandleHashTasksMessage = Message & {
  type: typeof HASH_TASKS;
  runnerOptions: any;
  env: any;
  tasks: Task[];
  taskGraph: TaskGraph;
};

export function isHandleHashTasksMessage(
  message: unknown
): message is HandleHashTasksMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === HASH_TASKS
  );
}
