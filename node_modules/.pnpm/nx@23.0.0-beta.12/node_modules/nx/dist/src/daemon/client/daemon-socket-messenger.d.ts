import { Socket } from 'net';
import { DaemonMessage } from '../message-types/daemon-message';
export declare class VersionMismatchError extends Error {
    constructor();
}
export declare class DaemonSocketMessenger {
    private socket;
    constructor(socket: Socket);
    sendMessage<T extends DaemonMessage>(messageToDaemon: T, force?: 'v8' | 'json'): void;
    listen(onData: (message: string) => void, onClose?: () => void, onError?: (err: Error) => void): DaemonSocketMessenger;
    close(): void;
}
