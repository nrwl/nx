import type { PseudoIPCClient } from '../pseudo-ipc';

// Set on the env of a producer whose readyWhen is `signal`
export const READY_SIGNAL_SOCKET_ENV = 'NX_READY_SIGNAL_SOCKET';
export const READY_SIGNAL_TASK_ENV = 'NX_READY_SIGNAL_TASK';
// Set on the env of a task that waited for a producer that signalled its url
export const READY_URL_ENV = 'NX_READY_URL';

// Carries the address the server listens on
export type ReadySignalMessage = {
  type: 'nx-ready-signal:ready';
  taskId: string;
  url?: string;
};

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

/**
 * `configured` moved to the address the server reported, for a task that
 * waited for a signal: its protocol and port, and its host unless `configured`
 * names localhost and the server listens on loopback. Keeps the path and
 * query. Returns `configured` when no address was reported, and the reported
 * address when `configured` is missing or not a URL.
 */
export function getReadyUrl(configured: string): string;
export function getReadyUrl(configured?: string): string | undefined;
export function getReadyUrl(configured?: string): string | undefined {
  const ready = process.env[READY_URL_ENV];
  if (!ready || !URL.canParse(ready)) {
    return configured;
  }
  if (!configured || !URL.canParse(configured)) {
    return ready;
  }
  const url = new URL(configured);
  const reported = new URL(ready);
  url.protocol = reported.protocol;
  url.port = reported.port;
  // A localhost name reaches either loopback address; an IP literal only its own
  if (!isLocalhostName(url.hostname) || !isLoopback(reported.hostname)) {
    url.hostname = reported.hostname;
  }
  return url.toString();
}

function isLocalhostName(hostname: string): boolean {
  return hostname === 'localhost' || hostname.endsWith('.localhost');
}

function isLoopback(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '');
  return isLocalhostName(host) || host === '::1' || /^127\./.test(host);
}
