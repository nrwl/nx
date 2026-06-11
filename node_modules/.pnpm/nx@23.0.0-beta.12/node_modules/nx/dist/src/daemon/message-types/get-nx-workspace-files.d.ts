export declare const GET_NX_WORKSPACE_FILES: "GET_NX_WORKSPACE_FILES";
export type HandleNxWorkspaceFilesMessage = {
    type: typeof GET_NX_WORKSPACE_FILES;
    projectRootMap: Record<string, string>;
};
export declare function isHandleNxWorkspaceFilesMessage(message: unknown): message is HandleNxWorkspaceFilesMessage;
