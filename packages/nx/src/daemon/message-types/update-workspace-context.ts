export const UPDATE_WORKSPACE_CONTEXT = 'UPDATE_WORKSPACE_CONTEXT' as const;

export type HandleUpdateWorkspaceContextMessage = {
  type: typeof UPDATE_WORKSPACE_CONTEXT;
  createdFiles: string[];
  updatedFiles: string[];
  deletedFiles: string[];
};

export function isHandleUpdateWorkspaceContextMessage(
  message: unknown
): message is HandleUpdateWorkspaceContextMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === UPDATE_WORKSPACE_CONTEXT
  );
}
