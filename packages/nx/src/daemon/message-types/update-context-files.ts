export const UPDATE_CONTEXT_FILES = 'UPDATE_CONTEXT_FILES' as const;

export type HandleUpdateContextFilesMessage = {
  type: typeof UPDATE_CONTEXT_FILES;
  createdFiles: string[];
  updatedFiles: string[];
  deletedFiles: string[];
};

export function isHandleUpdateContextFilesMessage(
  message: unknown
): message is HandleUpdateContextFilesMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === UPDATE_CONTEXT_FILES
  );
}
