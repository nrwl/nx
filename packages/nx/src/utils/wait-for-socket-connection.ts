import { Socket, connect } from 'net';

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
export async function waitForSocketConnection(
  socketPath: string | (() => string | null),
  options?: {
    signal?: AbortSignal;
    maxAttempts?: number;
    delayMs?: number;
    /**
     * Called with the errno of each failed connect and the path it was made
     * against. Return `true` to stop polling: a permission refusal does not
     * heal by retrying, and without a way out the caller waits the full budget
     * and then cannot say why.
     *
     * The path is passed rather than left to the caller to recompute — with a
     * resolver it can differ per attempt, and the caller that reports the
     * refusal may no longer be able to resolve one at all.
     */
    onConnectError?: (
      error: NodeJS.ErrnoException,
      socketPath: string
    ) => boolean | void;
  }
): Promise<Socket | null> {
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const delayMs = options?.delayMs ?? DEFAULT_DELAY_MS;
  const signal = options?.signal;

  let attempts = 0;
  while (attempts < maxAttempts) {
    if (signal?.aborted) return null;
    await new Promise((r) => setTimeout(r, delayMs));
    if (signal?.aborted) return null;

    const path = typeof socketPath === 'function' ? socketPath() : socketPath;
    if (path) {
      const result = await tryConnect(path);
      if (result.socket) {
        return result.socket;
      }
      // The caller may need the errno this attempt produced — a refused
      // connection is reported very differently from a socket that is not
      // there yet, and polling past it only delays the same answer.
      if (result.error && options?.onConnectError?.(result.error, path)) {
        return null;
      }
    }
    attempts++;
  }
  return null;
}

function tryConnect(
  socketPath: string
): Promise<{ socket?: Socket; error?: NodeJS.ErrnoException }> {
  return new Promise((resolve) => {
    try {
      const socket = connect(socketPath, () => {
        resolve({ socket });
      });
      socket.once('error', (error) => {
        socket.destroy();
        resolve({ error });
      });
    } catch (error) {
      resolve({ error: error as NodeJS.ErrnoException });
    }
  });
}
