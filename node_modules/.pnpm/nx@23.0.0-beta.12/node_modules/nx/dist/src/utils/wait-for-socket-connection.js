"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.waitForSocketConnection = waitForSocketConnection;
const net_1 = require("net");
const DEFAULT_DELAY_MS = 10;
const DEFAULT_MAX_ATTEMPTS = 10_000;
/**
 * Polls an IPC socket path until a connection succeeds or the attempt
 * limit / abort signal is reached.
 *
 * @param socketPath - A fixed path string, or a function that resolves
 *   the path on each attempt (useful when the server hasn't written its
 *   socket file yet).
 * @returns The connected socket, or `null` if polling was exhausted or aborted.
 */
async function waitForSocketConnection(socketPath, options) {
    const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    const delayMs = options?.delayMs ?? DEFAULT_DELAY_MS;
    const signal = options?.signal;
    let attempts = 0;
    while (attempts < maxAttempts) {
        if (signal?.aborted)
            return null;
        await new Promise((r) => setTimeout(r, delayMs));
        if (signal?.aborted)
            return null;
        const path = typeof socketPath === 'function' ? socketPath() : socketPath;
        if (path) {
            const socket = await tryConnect(path);
            if (socket) {
                return socket;
            }
        }
        attempts++;
    }
    return null;
}
function tryConnect(socketPath) {
    return new Promise((resolve) => {
        try {
            const socket = (0, net_1.connect)(socketPath, () => {
                resolve(socket);
            });
            socket.once('error', () => {
                socket.destroy();
                resolve(null);
            });
        }
        catch {
            resolve(null);
        }
    });
}
