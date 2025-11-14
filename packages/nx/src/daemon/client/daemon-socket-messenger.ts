import { Socket } from 'net';
import { performance } from 'perf_hooks';
import {
  consumeMessagesFromSocket,
  MESSAGE_END_SEQ,
} from '../../utils/consume-messages-from-socket';
import { serialize } from '../socket-utils';

export interface Message extends Record<string, any> {
  type: string;
  data?: any;
}

export class DaemonSocketMessenger {
  constructor(private socket: Socket) {}

  async sendMessage(messageToDaemon: Message, force?: 'v8' | 'json') {
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
  }

  listen(
    onData: (message: string) => void,
    onClose: () => void = () => {},
    onError: (err: Error) => void = (err) => {}
  ) {
    this.socket.on(
      'data',
      consumeMessagesFromSocket(async (message) => {
        onData(message);
      })
    );

    this.socket.on('close', onClose);
    this.socket.on('error', onError);

    return this;
  }

  close() {
    this.socket.destroy();
  }
}
