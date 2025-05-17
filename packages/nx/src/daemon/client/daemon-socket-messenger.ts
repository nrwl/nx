import { serialize } from 'v8';
import { Socket } from 'net';
import { performance } from 'perf_hooks';
import {
  consumeMessagesFromSocket,
  MESSAGE_END_SEQ,
} from '../../utils/consume-messages-from-socket';

export interface Message extends Record<string, any> {
  type: string;
  data?: any;
}

export class DaemonSocketMessenger {
  constructor(private socket: Socket) {}

  async sendMessage(messageToDaemon: Message) {
    if (process.env.NX_USE_V8_SERIALIZER !== 'false') {
      const serialized = serialize(messageToDaemon);
      this.socket.write(serialized.toString('binary'));
    } else {
      this.socket.write(JSON.stringify(messageToDaemon));
    }
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
