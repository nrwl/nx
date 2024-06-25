export const GET_FILES_IN_DIRECTORY = 'GET_FILES_IN_DIRECTORY' as const;

export type HandleGetFilesInDirectoryMessage = {
  type: typeof GET_FILES_IN_DIRECTORY;
  dir: string;
};

export function isHandleGetFilesInDirectoryMessage(
  message: unknown
): message is HandleGetFilesInDirectoryMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === GET_FILES_IN_DIRECTORY
  );
}
