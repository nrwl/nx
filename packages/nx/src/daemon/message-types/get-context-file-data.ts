export const GET_CONTEXT_FILE_DATA = 'GET_CONTEXT_FILE_DATA' as const;

export type HandleContextFileDataMessage = {
  type: typeof GET_CONTEXT_FILE_DATA;
};

export function isHandleContextFileDataMessage(
  message: unknown
): message is HandleContextFileDataMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === GET_CONTEXT_FILE_DATA
  );
}
