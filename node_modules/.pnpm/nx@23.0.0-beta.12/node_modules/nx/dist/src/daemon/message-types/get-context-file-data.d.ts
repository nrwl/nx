export declare const GET_CONTEXT_FILE_DATA: "GET_CONTEXT_FILE_DATA";
export type HandleContextFileDataMessage = {
    type: typeof GET_CONTEXT_FILE_DATA;
};
export declare function isHandleContextFileDataMessage(message: unknown): message is HandleContextFileDataMessage;
