import { Task, TaskGraph } from '../../config/task-graph';
import { Message } from '../client/daemon-socket-messenger';

export const OUTPUTS_HASHES_MATCH = 'OUTPUTS_HASHES_MATCH' as const;

export type HandleOutputHashesMatchMessage = Message & {
  type: typeof OUTPUTS_HASHES_MATCH;
  data: { outputs: string[]; hash: string };
};

export function isHandleOutputHashesMatchMessage(
  message: unknown
): message is HandleOutputHashesMatchMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === OUTPUTS_HASHES_MATCH
  );
}
