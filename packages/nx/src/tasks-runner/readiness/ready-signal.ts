import type { PseudoIPCClient } from '../pseudo-ipc';

// Set on the env of a producer whose readyWhen is `signal`
export const READY_SIGNAL_SOCKET_ENV = 'NX_READY_SIGNAL_SOCKET';
export const READY_SIGNAL_TASK_ENV = 'NX_READY_SIGNAL_TASK';
// Set on the env of a task that waited for a producer that signalled its url
export const READY_URL_ENV = 'NX_READY_URL';

// `hello` says something in the producer will send `ready`, so a fallback
// check stops; `ready` carries the address the server listens on
export type ReadySignalMessage =
  | { type: 'nx-ready-signal:hello'; taskId: string }
  | { type: 'nx-ready-signal:ready'; taskId: string; url?: string };

let client: PseudoIPCClient | undefined;
let readySent = false;

function connect(): { client: PseudoIPCClient; taskId: string } | null {
  const path = process.env[READY_SIGNAL_SOCKET_ENV];
  const taskId = process.env[READY_SIGNAL_TASK_ENV];
  if (!path || !taskId) {
    return null;
  }
  // Required lazily to keep this module light for the task env code
  const { PseudoIPCClient } =
    require('../pseudo-ipc') as typeof import('../pseudo-ipc');
  // A failed connection must not crash the server it reports on, nor keep
  // its process alive
  client ??= new PseudoIPCClient(path)
    .onMessageFromParent(
      taskId,
      () => {},
      () => {},
      () => {}
    )
    .unref();
  return { client, taskId };
}

/**
 * Tells Nx that this process will report readiness with `signalTaskReady`.
 * Call it as early as possible. Returns false when no Nx task waits for a
 * signal from this process.
 */
export function announceTaskReadySignal(): boolean {
  const connection = connect();
  connection?.client.sendMessageToParent({
    type: 'nx-ready-signal:hello',
    taskId: connection.taskId,
  } satisfies ReadySignalMessage);
  return !!connection;
}

/**
 * Tells Nx that the task running this process is ready, for a target whose
 * readyWhen is `signal`. Only the first call counts. `url` is passed on to the
 * tasks that waited, as NX_READY_URL.
 */
export function signalTaskReady(details: { url?: string } = {}): boolean {
  const connection = connect();
  if (!connection || readySent) {
    return false;
  }
  readySent = true;
  connection.client.sendMessageToParent({
    type: 'nx-ready-signal:ready',
    taskId: connection.taskId,
    ...(details.url ? { url: details.url } : {}),
  } satisfies ReadySignalMessage);
  return true;
}
