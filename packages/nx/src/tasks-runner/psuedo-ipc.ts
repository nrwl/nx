/**
 * Node IPC is specific to Node, but when spawning child processes in Rust, it won't have IPC.
 *
 * Thus, this is a wrapper which is spawned by Rust, which will create a Node IPC channel and pipe it to a ZeroMQ Channel
 *
 * Main Nx Process
 *   * Calls Rust Fork Function
 *     * `node fork.js`
 *     * Create a Rust - Node.js Agnostic Channel aka Psuedo IPC Channel
 *     * This returns RustChildProcess
 *         * RustChildProcess.onMessage(msg => ());
 *         * psuedo_ipc_channel.on_message() => tx.send(msg);
 *   * Node.js Fork Wrapper (fork.js)
 *     * fork(run-command.js) with `inherit` and `ipc`
 *         * This will create a Node IPC Channel
 *     * channel = getPsuedoIpcChannel(process.env.NX_IPC_CHANNEL_ID)
 *     * forkChildProcess.on('message', writeToPsuedoIpcChannel)
 */

import { connect, Server, Socket } from 'net';
import { consumeMessagesFromSocket } from '../utils/consume-messages-from-socket';
import { Serializable } from 'child_process';

export interface PsuedoIPCMessage {
  type: 'TO_CHILDREN_FROM_PARENT' | 'TO_PARENT_FROM_CHILDREN' | 'CHILD_READY';
  id: string | undefined;
  message: Serializable;
}

export class PsuedoIPCServer {
  private sockets = new Set<Socket>();
  private server: Server | undefined;

  private childMessages: {
    onMessage: (message: Serializable) => void;
    onClose?: () => void;
    onError?: (err: Error) => void;
  }[] = [];

  constructor(private path: string) {}

  init(): Promise<void> {
    return new Promise((res) => {
      this.server = new Server((socket) => {
        this.sockets.add(socket);
        this.registerChildMessages(socket);
        socket.on('close', () => {
          this.sockets.delete(socket);
        });
      });
      this.server.listen(this.path, () => {
        res();
      });
    });
  }

  private childReadyMap = new Map<string, () => void>();

  async waitForChildReady(childId: string) {
    return new Promise<void>((res) => {
      this.childReadyMap.set(childId, res);
    });
  }

  private registerChildMessages(socket: Socket) {
    socket.on(
      'data',
      consumeMessagesFromSocket(async (rawMessage) => {
        const { type, message }: PsuedoIPCMessage = JSON.parse(rawMessage);
        if (type === 'TO_PARENT_FROM_CHILDREN') {
          for (const childMessage of this.childMessages) {
            childMessage.onMessage(message);
          }
        } else if (type === 'CHILD_READY') {
          const childId = message as string;
          if (this.childReadyMap.has(childId)) {
            this.childReadyMap.get(childId)();
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
  }
}

export class PsuedoIPCClient {
  private socket: Socket | undefined = connect(this.path);

  constructor(private path: string) {}
  sendMessageToParent(message: Serializable) {
    this.socket.write(
      JSON.stringify({ type: 'TO_PARENT_FROM_CHILDREN', message })
    );
    // send EOT to indicate that the message has been fully written
    this.socket.write(String.fromCodePoint(4));
  }

  notifyChildIsReady(id: string) {
    this.socket.write(
      JSON.stringify({
        type: 'CHILD_READY',
        message: id,
      } as PsuedoIPCMessage)
    );
    // send EOT to indicate that the message has been fully written
    this.socket.write(String.fromCodePoint(4));
  }

  onMessageFromParent(
    forkId: string,
    onMessage: (message: Serializable) => void,
    onClose: () => void = () => {},
    onError: (err: Error) => void = (err) => {}
  ) {
    this.socket.on(
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

    this.socket.on('close', onClose);
    this.socket.on('error', onError);

    return this;
  }
  close() {
    this.socket?.destroy();
  }
}
