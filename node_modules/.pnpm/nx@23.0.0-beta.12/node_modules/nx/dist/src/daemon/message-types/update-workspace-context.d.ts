export declare const UPDATE_WORKSPACE_CONTEXT: "UPDATE_WORKSPACE_CONTEXT";
export type HandleUpdateWorkspaceContextMessage = {
    type: typeof UPDATE_WORKSPACE_CONTEXT;
    createdFiles: string[];
    updatedFiles: string[];
    deletedFiles: string[];
};
export declare function isHandleUpdateWorkspaceContextMessage(message: unknown): message is HandleUpdateWorkspaceContextMessage;
