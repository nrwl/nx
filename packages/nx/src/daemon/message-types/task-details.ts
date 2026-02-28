import type { HashedTask } from '../../native';

export const RECORD_TASK_DETAILS = 'RECORD_TASK_DETAILS' as const;

export type HandleRecordTaskDetailsMessage = {
  type: typeof RECORD_TASK_DETAILS;
  taskDetails: HashedTask[];
};

export function isHandleRecordTaskDetailsMessage(
  message: unknown
): message is HandleRecordTaskDetailsMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === RECORD_TASK_DETAILS
  );
}
