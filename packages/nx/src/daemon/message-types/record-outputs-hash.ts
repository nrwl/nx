import { Task, TaskGraph } from '../../config/task-graph';
import { Message } from '../client/daemon-socket-messenger';

export const RECORD_OUTPUTS_HASH = 'RECORD_OUTPUTS_HASH' as const;

export type HandleRecordOutputsHashMessage = Message & {
  type: typeof RECORD_OUTPUTS_HASH;
  data: { outputs: string[]; hash: string };
};

export function isHandleRecordOutputsHashMessage(
  message: unknown
): message is HandleRecordOutputsHashMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === RECORD_OUTPUTS_HASH
  );
}
