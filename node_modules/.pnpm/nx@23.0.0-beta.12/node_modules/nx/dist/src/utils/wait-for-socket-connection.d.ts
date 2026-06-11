import { Socket } from 'net';
/**
 * Polls an IPC socket path until a connection succeeds or the attempt
 * limit / abort signal is reached.
 *
 * @param socketPath - A fixed path string, or a function that resolves
 *   the path on each attempt (useful when the server hasn't written its
 *   socket file yet).
 * @returns The connected socket, or `null` if polling was exhausted or aborted.
 */
export declare function waitForSocketConnection(socketPath: string | (() => string | null), options?: {
    signal?: AbortSignal;
    maxAttempts?: number;
    delayMs?: number;
}): Promise<Socket | null>;
