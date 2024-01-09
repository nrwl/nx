import { connect, Socket } from 'net';
import { consumeMessagesFromSocket } from '../utils/consume-messages-from-socket';
import { Serializable } from 'child_process';

interface PsuedoIPCMessage {
  type: 'TO_CHILDREN_FROM_PARENT' | 'TO_PARENT_FROM_CHILDREN';
  message: Serializable;
}

export class PsuedoIPC {
  socket: Socket;

  constructor(path: string) {
    this.socket = connect(path);
  }

  sendMessageToChildren(message: Serializable) {
    this.socket.write(
      JSON.stringify({ type: 'TO_CHILDREN_FROM_PARENT', message })
    );
    // send EOT to indicate that the message has been fully written
    this.socket.write(String.fromCodePoint(4));
  }

  sendMessageToParent(message: Serializable) {
    this.socket.write(
      JSON.stringify({ type: 'TO_PARENT_FROM_CHILDREN', message })
    );
    // send EOT to indicate that the message has been fully written
    this.socket.write(String.fromCodePoint(4));
  }
  onMessageFromParent(
    onMessage: (message: Serializable) => void,
    onClose: () => void = () => {},
    onError: (err: Error) => void = (err) => {}
  ) {
    this.socket.on(
      'data',
      consumeMessagesFromSocket(async (rawMessage) => {
        const { type, message }: PsuedoIPCMessage = JSON.parse(rawMessage);
        if (type === 'TO_CHILDREN_FROM_PARENT') {
          onMessage(message);
        }
      })
    );

    this.socket.on('close', onClose);
    this.socket.on('error', onError);

    return this;
  }

  onMessageFromChildren(
    onMessage: (message: Serializable) => void,
    onClose: () => void = () => {},
    onError: (err: Error) => void = (err) => {}
  ) {
    this.socket.on(
      'data',
      consumeMessagesFromSocket(async (rawMessage) => {
        const { type, message }: PsuedoIPCMessage = JSON.parse(rawMessage);
        if (type === 'TO_PARENT_FROM_CHILDREN') {
          onMessage(message);
        }
      })
    );

    this.socket.on('close', onClose);
    this.socket.on('error', onError);
  }

  close() {
    this.socket.destroy();
  }
}
