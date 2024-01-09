import { connect, Server, Socket } from 'net';
import { consumeMessagesFromSocket } from '../utils/consume-messages-from-socket';
import { Serializable } from 'child_process';

export interface PsuedoIPCMessage {
  type: 'TO_CHILDREN_FROM_PARENT' | 'TO_PARENT_FROM_CHILDREN';
  id: string | undefined;
  message: Serializable;
}

export class PsuedoIPC {
  sockets = new Set<Socket>();
  server: Server | undefined;
  parentSocket: Socket | undefined;

  childMessages: {
    onMessage: (message: Serializable) => void;
    onClose?: () => void;
    onError?: (err: Error) => void;
  }[] = [];

  constructor(private path: string, private isParent: boolean) {}

  init(): Promise<void> {
    return new Promise((res) => {
      if (this.isParent) {
        this.server = new Server((socket) => {
          console.log('client connected');
          this.sockets.add(socket);
          this._registerChildMessages(socket);
          socket.on('close', () => {
            this.sockets.delete(socket);
          });
        });
        this.server.listen(this.path, () => {
          res();
        });
      } else {
        this.parentSocket = connect(this.path);
        res();
      }
    });
  }

  private _registerChildMessages(socket: Socket) {
    socket.on(
      'data',
      consumeMessagesFromSocket(async (rawMessage) => {
        const { type, message }: PsuedoIPCMessage = JSON.parse(rawMessage);
        if (type === 'TO_PARENT_FROM_CHILDREN') {
          for (const childMessage of this.childMessages) {
            childMessage.onMessage(message);
          }
        }
      })
    );

    socket.on('close', () => {
      for (const childMessage of this.childMessages) {
        childMessage.onClose?.();
      }
    });
    socket.on('error', (err) => {
      for (const childMessage of this.childMessages) {
        childMessage.onError?.(err);
      }
    });
  }

  sendMessageToChildren(message: Serializable) {
    this.sockets.forEach((socket) => {
      socket.write(
        JSON.stringify({ type: 'TO_CHILDREN_FROM_PARENT', message })
      );
      // send EOT to indicate that the message has been fully written
      socket.write(String.fromCodePoint(4));
    });
  }

  sendMessageToChild(id: string, message: Serializable) {
    this.sockets.forEach((socket) => {
      socket.write(
        JSON.stringify({ type: 'TO_CHILDREN_FROM_PARENT', id, message })
      );
      socket.write(String.fromCodePoint(4));
    });
  }

  sendMessageToParent(message: Serializable) {
    this.sockets.forEach((socket) => {
      socket.write(
        JSON.stringify({ type: 'TO_PARENT_FROM_CHILDREN', message })
      );
      // send EOT to indicate that the message has been fully written
      socket.write(String.fromCodePoint(4));
    });
  }

  onMessageFromParent(
    forkId: string,
    onMessage: (message: Serializable) => void,
    onClose: () => void = () => {},
    onError: (err: Error) => void = (err) => {}
  ) {
    this.parentSocket.on(
      'data',
      consumeMessagesFromSocket(async (rawMessage) => {
        const { id, type, message }: PsuedoIPCMessage = JSON.parse(rawMessage);
        if (type === 'TO_CHILDREN_FROM_PARENT') {
          if (id && id === forkId) {
            onMessage(message);
          } else if (id === undefined) {
            onMessage(message);
          }
        }
      })
    );

    this.parentSocket.on('close', onClose);
    this.parentSocket.on('error', onError);

    return this;
  }

  onMessageFromChildren(
    onMessage: (message: Serializable) => void,
    onClose: () => void = () => {},
    onError: (err: Error) => void = (err) => {}
  ) {
    this.childMessages.push({
      onMessage,
      onClose,
      onError,
    });
  }

  close() {
    this.server?.close();
    this.sockets.forEach((s) => s.destroy());
    this.parentSocket?.destroy();
  }
}
