export interface FileChangeEvent {
    createdFiles: string[];
    updatedFiles: string[];
    deletedFiles: string[];
}
export declare function registerFileChangeListener(listener: (event: FileChangeEvent) => void): void;
export declare function notifyFileChangeListeners(event: FileChangeEvent): void;
