import { AsyncLocalStorage } from 'async_hooks';
import type { Socket } from 'net';
import { MESSAGE_END_SEQ } from '../../utils/consume-messages-from-socket';
import {
  EMIT_LOG,
  EmitLogLevel,
  UPDATE_PROGRESS_MESSAGE,
} from '../message-types/streaming-messages';
import { isOnDaemon } from '../is-on-daemon';
import { serverLogger } from '../logger';

// Messages that stream back to the client while a request is in flight
// (progress updates, log forwarding) need to know which socket belongs to
// the currently-handled request. Threading a socket through every layer
// of the handler call tree would be invasive, so we stash it in
// AsyncLocalStorage and surface it via the helpers below.
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

function assertOnDaemon(helperName: string) {
  if (!isOnDaemon()) {
    throw new Error(
      `${helperName} can only be called from the Nx daemon process.`
    );
  }
}

function writeStreamingMessage(socket: Socket, payload: unknown) {
  try {
    socket.write(JSON.stringify(payload) + MESSAGE_END_SEQ, (err) => {
      if (err) {
        serverLogger.log(
          `Streaming message write error (client likely disconnected): ${err.message}`
        );
      }
    });
  } catch (e) {
    serverLogger.log(
      `Failed to send streaming message to client: ${
        e instanceof Error ? e.message : String(e)
      }`
    );
  }
}

/**
 * Sends a progress message to the currently-connected client, which will
 * update the in-flight spinner on the client side. No-op when called
 * outside of a request-handling async context (no active client socket).
 *
 * Must only be invoked from inside the Nx daemon process.
 */
export function sendProgressMessageToClient(message: string): void {
  assertOnDaemon('sendProgressMessageToClient');
  const socket = getActiveClientSocket();
  if (!socket) return;
  writeStreamingMessage(socket, {
    type: UPDATE_PROGRESS_MESSAGE,
    message,
  });
}

/**
 * Emits a log line to the currently-connected client. If invoked outside
 * of a request-handling async context (e.g. background daemon work with
 * no subscriber), the message is written to the daemon logger instead so
 * it is not silently dropped.
 *
 * Must only be invoked from inside the Nx daemon process.
 */
export function emitLogToClient(level: EmitLogLevel, message: string): void {
  assertOnDaemon('emitLogToClient');
  const socket = getActiveClientSocket();
  if (!socket) {
    serverLogger.log(`[emit-log:${level}] ${message}`);
    return;
  }
  writeStreamingMessage(socket, {
    type: EMIT_LOG,
    level,
    message,
  });
}
