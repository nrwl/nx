import { Socket } from 'net';
import { performance } from 'perf_hooks';
import {
  consumeMessagesFromSocket,
  writeMessage,
} from '../../utils/consume-messages-from-socket';
import { workspaceRoot } from '../../utils/workspace-root';
import { clientLogger } from '../logger';
import { DaemonMessage } from '../message-types/daemon-message';
import { serialize } from '../socket-utils';

export class VersionMismatchError extends Error {
  constructor() {
    super('Version mismatch with daemon server');
    this.name = 'VersionMismatchError';
    Object.setPrototypeOf(this, VersionMismatchError.prototype);
  }
}

export class DaemonSocketMessenger {
  constructor(private socket: Socket) {}

  sendMessage<T extends DaemonMessage>(
    messageToDaemon: T,
    force?: 'v8' | 'json'
  ) {
    if (!this.socket) {
      throw new Error('Socket not initialized.');
    }
    // Stamp every message with the sending workspace's root so the daemon can
    // reject messages from a different workspace (e.g. a shared NX_SOCKET_DIR).
    messageToDaemon.workspaceRoot = workspaceRoot;
    clientLogger.log('[Messenger] Sending message type:', messageToDaemon.type);
    performance.mark(
      'daemon-message-serialization-start-' + messageToDaemon.type
    );
    const serialized = serialize(messageToDaemon, force);
    performance.mark(
      'daemon-message-serialization-end-' + messageToDaemon.type
    );
    performance.measure(
      'daemon-message-serialization-' + messageToDaemon.type,
      'daemon-message-serialization-start-' + messageToDaemon.type,
      'daemon-message-serialization-end-' + messageToDaemon.type
    );
    writeMessage(this.socket, serialized);
    clientLogger.log('[Messenger] Message sent');
  }

  listen(
    onData: (message: Buffer) => void,
    onClose: () => void = () => {},
    onError: (err: Error) => void = () => {}
  ): DaemonSocketMessenger {
    clientLogger.log('[Messenger] Setting up socket listeners');

    this.socket.on('close', onClose);
    this.socket.on('error', (err) => {
      clientLogger.log('[Messenger] Socket error:', err.message);
      onError(err);
    });

    this.socket.on(
      'data',
      consumeMessagesFromSocket(
        async (message) => {
          clientLogger.log(
            '[Messenger] Received message, length:',
            message.length
          );
          onData(message);
        },
        // A framing failure leaves the socket open and writable, so nothing
        // else settles the in-flight request. Route it to the same handler as
        // a socket error rather than waiting for the keep-alive timeout.
        (err) => {
          clientLogger.log('[Messenger] Framing error:', err.message);
          onError(err);
        }
      )
    );

    clientLogger.log('[Messenger] listen() complete');
    return this;
  }

  close() {
    if (this.socket) {
      this.socket.destroy();
    }
  }
}
