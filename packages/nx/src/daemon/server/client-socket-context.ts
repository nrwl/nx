import { AsyncLocalStorage } from 'async_hooks';
import type { Socket } from 'net';
import { MESSAGE_END_SEQ } from '../../utils/consume-messages-from-socket';
import { UPDATE_PROGRESS_MESSAGE } from '../message-types/streaming-messages';
import { isOnDaemon } from '../is-on-daemon';
import { serialize } from '../socket-utils';

// Messages that stream back to the client while a request is in flight
// (progress updates, log forwarding) need to know which socket belongs
// to the currently-handled request. Threading a socket through every
// layer of the handler call tree would be invasive, so we stash it in
// AsyncLocalStorage.
const clientSocketStorage = new AsyncLocalStorage<Socket>();

export function runWithClientSocket<T>(
  socket: Socket,
  fn: () => Promise<T> | T
): Promise<T> | T {
  return clientSocketStorage.run(socket, fn);
}

export function getActiveClientSocket(): Socket | undefined {
  return clientSocketStorage.getStore();
}

export function assertOnDaemon(helperName: string) {
  if (!isOnDaemon()) {
    throw new Error(
      `${helperName} can only be called from the Nx daemon process.`
    );
  }
}

/**
 * Writes a streaming message over the given socket using the daemon's
 * configured serialization format and terminated with MESSAGE_END_SEQ.
 * Errors are logged to the daemon's stdout (redirected to the daemon
 * log) rather than propagated — a disconnected client shouldn't tear
 * down the current request handler.
 */
export function writeStreamingMessage(socket: Socket, payload: unknown) {
  try {
    socket.write(serialize(payload) + MESSAGE_END_SEQ, (err) => {
      if (err) {
        console.log(
          `Streaming message write error (client likely disconnected): ${err.message}`
        );
      }
    });
  } catch (e) {
    console.log(
      `Failed to send streaming message to client: ${
        e instanceof Error ? e.message : String(e)
      }`
    );
  }
}

/**
 * Sends a progress message to the currently-connected client, which
 * will update the in-flight spinner on the client side. No-op when
 * called outside of a request-handling async context (no active client
 * socket).
 *
 * Must only be invoked from inside the Nx daemon process.
 */
export function sendProgressMessageToClient(message: string): void {
  assertOnDaemon('sendProgressMessageToClient');
  const socket = clientSocketStorage.getStore();
  if (!socket) return;
  writeStreamingMessage(socket, {
    type: UPDATE_PROGRESS_MESSAGE,
    message,
  });
}
