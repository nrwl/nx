import { randomUUID } from 'crypto';
import { Socket } from 'net';
import { performance } from 'perf_hooks';
import { consumeMessagesFromSocket } from '../../utils/consume-messages-from-socket';

export interface Message extends Record<string, any> {
  type: string;
  data?: any;
}

export class SocketMessenger {
  constructor(private socket: Socket) {}

  async sendMessage(messageToDaemon: Message) {
    this.socket.write(JSON.stringify(messageToDaemon));
    // send EOT to indicate that the message has been fully written
    this.socket.write(String.fromCodePoint(4));
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
