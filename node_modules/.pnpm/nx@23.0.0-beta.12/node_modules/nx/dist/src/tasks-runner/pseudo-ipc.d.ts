/**
 * Node IPC is specific to Node, but when spawning child processes in Rust, it won't have IPC.
 *
 * Thus, this is a wrapper which is spawned by Rust, which will create a Node IPC channel and pipe it to a ZeroMQ Channel
 *
 * Main Nx Process
 *   * Calls Rust Fork Function
 *     * `node fork.js`
 *     * Create a Rust - Node.js Agnostic Channel aka Pseudo IPC Channel
 *     * This returns RustChildProcess
 *         * RustChildProcess.onMessage(msg => ());
 *         * pseudo_ipc_channel.on_message() => tx.send(msg);
 *   * Node.js Fork Wrapper (fork.js)
 *     * fork(run-command.js) with `inherit` and `ipc`
 *         * This will create a Node IPC Channel
 *     * channel = getPseudoIpcChannel(process.env.NX_IPC_CHANNEL_ID)
 *     * forkChildProcess.on('message', writeToPseudoIpcChannel)
 */
import { Serializable } from 'child_process';
export interface PseudoIPCMessage {
    type: 'TO_CHILDREN_FROM_PARENT' | 'TO_PARENT_FROM_CHILDREN' | 'CHILD_READY';
    id: string | undefined;
    message: Serializable;
}
export declare class PseudoIPCServer {
    private path;
    private sockets;
    private server;
    private childMessages;
    constructor(path: string);
    init(): Promise<void>;
    private childReadyMap;
    waitForChildReady(childId: string): Promise<void>;
    private registerChildMessages;
    sendMessageToChildren(message: Serializable): void;
    sendMessageToChild(id: string, message: Serializable): void;
    onMessageFromChildren(onMessage: (message: Serializable) => void, onClose?: () => void, onError?: (err: Error) => void): void;
    close(): void;
}
export declare class PseudoIPCClient {
    private path;
    private socket;
    constructor(path: string);
    sendMessageToParent(message: Serializable): void;
    notifyChildIsReady(id: string): void;
    onMessageFromParent(forkId: string, onMessage: (message: Serializable) => void, onClose?: () => void, onError?: (err: Error) => void): this;
    close(): void;
}
