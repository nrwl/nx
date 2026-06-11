import type { Server, Socket } from 'net';
import type { Watcher } from '../../native';
export declare const SERVER_INACTIVITY_TIMEOUT_MS: 10800000;
export declare function storeWatcherInstance(instance: Watcher): void;
export declare function getWatcherInstance(): Watcher;
export declare function storeOutputWatcherInstance(instance: Watcher): void;
export declare function getOutputWatcherInstance(): Watcher;
interface HandleServerProcessTerminationParams {
    server: Server;
    reason: string;
    sockets: Iterable<Socket>;
}
export declare function handleServerProcessTermination({ server, reason, sockets, }: HandleServerProcessTerminationParams): Promise<void>;
export declare function handleServerProcessTerminationWithRestart({ server, reason, sockets, }: HandleServerProcessTerminationParams): Promise<void>;
export declare function resetInactivityTimeout(cb: () => void): void;
export declare function respondToClient(socket: Socket, response: string, description: string): Promise<unknown>;
export declare function respondWithErrorAndExit(socket: Socket, description: string, error: Error): Promise<void>;
export {};
