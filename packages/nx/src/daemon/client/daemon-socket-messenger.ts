import { Socket } from 'net';
import { performance } from 'perf_hooks';
import {
  consumeMessagesFromSocket,
  MESSAGE_END_SEQ,
} from '../../utils/consume-messages-from-socket';
import { serialize } from '../socket-utils';
import { clientLogger } from '../logger';

export interface Message extends Record<string, any> {
  type: string;
  data?: any;
}

export class VersionMismatchError extends Error {
  constructor() {
    super('Version mismatch with daemon server');
    this.name = 'VersionMismatchError';
    Object.setPrototypeOf(this, VersionMismatchError.prototype);
  }
}

export class DaemonSocketMessenger {
  constructor(private socket: Socket) {}

  sendMessage(messageToDaemon: Message, force?: 'v8' | 'json') {
    if (!this.socket) {
      throw new Error('Socket not initialized.');
    }
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
    this.socket.write(serialized);
    // send EOT to indicate that the message has been fully written
    this.socket.write(MESSAGE_END_SEQ);
    clientLogger.log('[Messenger] Message sent');
  }

  listen(
    onData: (message: string) => void,
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
      consumeMessagesFromSocket(async (message) => {
        clientLogger.log('[Messenger] Received message, length:', message.length);
        onData(message);
      })
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
