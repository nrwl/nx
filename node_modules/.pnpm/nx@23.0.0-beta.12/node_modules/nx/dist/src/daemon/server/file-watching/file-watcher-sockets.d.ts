import { Socket } from 'net';
export declare let registeredFileWatcherSockets: {
    socket: Socket;
    config: {
        watchProjects: string[] | 'all';
        includeGlobalWorkspaceFiles: boolean;
        includeDependentProjects: boolean;
    };
}[];
export declare function removeRegisteredFileWatcherSocket(socket: Socket): void;
export declare function hasRegisteredFileWatcherSockets(): boolean;
export declare function notifyFileWatcherSockets(createdFiles: string[] | null, updatedFiles: string[], deletedFiles: string[]): void;
