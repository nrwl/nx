import { Task, TaskGraph } from '../../config/task-graph';
import { Message } from '../client/daemon-socket-messenger';

export const PROCESS_IN_BACKGROUND = 'PROCESS_IN_BACKGROUND' as const;

export type HandleProcessInBackgroundMessage = Message & {
  type: typeof PROCESS_IN_BACKGROUND;
  requirePath: string;
  data: any;
};

export function isHandleProcessInBackgroundMessageMessage(
  message: unknown
): message is HandleProcessInBackgroundMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === PROCESS_IN_BACKGROUND
  );
}
