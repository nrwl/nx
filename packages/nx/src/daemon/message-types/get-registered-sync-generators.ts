export const GET_REGISTERED_SYNC_GENERATORS =
  'GET_REGISTERED_SYNC_GENERATORS' as const;

export type HandleGetRegisteredSyncGeneratorsMessage = {
  type: typeof GET_REGISTERED_SYNC_GENERATORS;
};

export function isHandleGetRegisteredSyncGeneratorsMessage(
  message: unknown
): message is HandleGetRegisteredSyncGeneratorsMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === GET_REGISTERED_SYNC_GENERATORS
  );
}
