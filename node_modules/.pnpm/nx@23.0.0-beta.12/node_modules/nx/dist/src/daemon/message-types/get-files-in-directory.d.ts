export declare const GET_FILES_IN_DIRECTORY: "GET_FILES_IN_DIRECTORY";
export type HandleGetFilesInDirectoryMessage = {
    type: typeof GET_FILES_IN_DIRECTORY;
    dir: string;
};
export declare function isHandleGetFilesInDirectoryMessage(message: unknown): message is HandleGetFilesInDirectoryMessage;
