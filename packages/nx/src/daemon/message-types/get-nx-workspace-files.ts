export const GET_NX_WORKSPACE_FILES = 'GET_NX_WORKSPACE_FILES' as const;

export type HandleNxWorkspaceFilesMessage = {
  type: typeof GET_NX_WORKSPACE_FILES;
  projectRootMap: Record<string, string>;
};

export function isHandleNxWorkspaceFilesMessage(
  message: unknown
): message is HandleNxWorkspaceFilesMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === GET_NX_WORKSPACE_FILES
  );
}
