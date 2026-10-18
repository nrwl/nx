import { getForkedProcessOsSocketPath } from '../../daemon/socket-utils';
import { PseudoIPCServer } from '../pseudo-ipc';
import {
  READY_SIGNAL_SOCKET_ENV,
  READY_SIGNAL_TASK_ENV,
  type ReadySignalMessage,
} from './ready-signal';

export type ReadySignalListener = (message: ReadySignalMessage) => void;

let id = 0;

/**
 * Receives the readiness signals of the producers this process starts. It
 * does not depend on the pseudo terminal, which Windows and non-TTY runs lack.
 */
export class ReadySignalServer {
  private readonly path = getForkedProcessOsSocketPath(
    `${process.pid}-ready-${id++}`
  );
  private readonly server = new PseudoIPCServer(this.path);
  private started: Promise<void> | undefined;
  private listeners = new Map<string, ReadySignalListener>();
  // A producer can signal before its probe subscribes. Only tasks given the
  // socket are buffered for.
  private early = new Map<string, ReadySignalMessage[]>();
  private issued = new Set<string>();

  async env(taskId: string): Promise<NodeJS.ProcessEnv> {
    this.started ??= this.server.init().then(() => {
      this.server.onMessageFromChildren((message) => {
        if (isReadySignalMessage(message)) this.dispatch(message);
      });
    });
    await this.started;
    this.issued.add(taskId);
    return {
      [READY_SIGNAL_SOCKET_ENV]: this.path,
      [READY_SIGNAL_TASK_ENV]: taskId,
    };
  }

  subscribe(taskId: string, listener: ReadySignalListener): () => void {
    this.listeners.set(taskId, listener);
    for (const message of this.early.get(taskId) ?? []) {
      listener(message);
    }
    this.early.delete(taskId);
    return () => {
      if (this.listeners.get(taskId) === listener) {
        this.listeners.delete(taskId);
      }
    };
  }

  close() {
    if (this.started) {
      this.server.close();
    }
  }

  private dispatch(message: ReadySignalMessage) {
    const listener = this.listeners.get(message.taskId);
    if (listener) {
      listener(message);
    } else if (this.issued.has(message.taskId)) {
      const early = this.early.get(message.taskId) ?? [];
      early.push(message);
      this.early.set(message.taskId, early);
    }
  }
}

function isReadySignalMessage(message: unknown): message is ReadySignalMessage {
  if (typeof message !== 'object' || message === null) return false;
  const { type, taskId } = message as Record<string, unknown>;
  return (
    (type === 'nx-ready-signal:hello' || type === 'nx-ready-signal:ready') &&
    typeof taskId === 'string'
  );
}
