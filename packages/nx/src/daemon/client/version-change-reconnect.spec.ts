import { randomBytes } from 'crypto';
import { createServer, Server, Socket } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';

vi.mock('../logger', () => ({
  clientLogger: { log: vi.fn() },
}));

vi.mock('../cache', async () => ({
  ...(await vi.importActual('../cache')),
  getDaemonProcessIdSync: vi.fn(() => undefined),
}));

import { consumeMessagesFromSocket } from '../../utils/consume-messages-from-socket';
import { sendMessage } from '../socket-utils';
import { DaemonClient } from './client';

/**
 * The daemon shuts down when it finds itself outdated: it destroys every open
 * socket and exits, without answering whatever was in flight, and — for
 * NX_VERSION_CHANGED — without starting a replacement. See `daemonIsOutdated`
 * and `handleServerProcessTermination` in `../server`.
 */
describe('a daemon that shuts down mid-request', () => {
  const servers: Server[] = [];
  const accepted: Socket[] = [];
  const clients: DaemonClient[] = [];
  // Each daemon binds its own path and records it where `getSocketPath` reads
  // it, the way a real one writes its socketPath into the process json.
  let socketPath: string;

  afterEach(() => {
    // A client socket left open holds `server.close` pending forever, and the
    // client unrefs its sockets so neither side tears the other down.
    clients.splice(0).forEach((client) => client.reset());
    accepted.splice(0).forEach((socket) => socket.destroy());
    // The callback swallows ERR_SERVER_NOT_RUNNING for a daemon a test already
    // shut down, which `close` would otherwise emit as an unhandled error.
    servers.splice(0).forEach((server) => server.close(() => {}));
  });

  const listen = async (
    onMessage: (socket: Socket, server: Server) => void
  ): Promise<Server> => {
    const server = createServer((socket) => {
      accepted.push(socket);
      // The client destroys its socket on the way out, so a reply already on
      // the way fails the write. A real daemon passes a callback for this.
      socket.on('error', () => {});
      socket.on(
        'data',
        consumeMessagesFromSocket(() => onMessage(socket, server))
      );
    });
    servers.push(server);
    socketPath = join(
      tmpdir(),
      `nx-version-change-${randomBytes(6).toString('hex')}.sock`
    );
    await new Promise<void>((res) => server.listen(socketPath, res));
    return server;
  };

  /** Reads one message, then shuts down the way `performShutdown` does. */
  const startOutdatedDaemon = () =>
    listen((socket, server) => {
      socket.destroy();
      server.close();
    });

  const startHealthyDaemon = () =>
    listen((socket) => sendMessage(socket, { hashes: {} }));

  const buildClient = () => {
    const client = new DaemonClient();
    (client as any).getSocketPath = () => socketPath;
    clients.push(client);
    return client;
  };

  it('restarts the daemon and retries the request', async () => {
    await startOutdatedDaemon();

    const client = buildClient();
    // Nothing restarts a daemon that stopped because the installed version
    // changed, so the poll finds none — the client has to start one.
    const waitedWith: any[] = [];
    (client as any).waitForServerToBeAvailable = async (options: any) => {
      waitedWith.push(options);
      return { available: false };
    };
    let restarts = 0;
    (client as any).startInBackground = async () => {
      restarts++;
      await startHealthyDaemon();
      return 4242;
    };

    const response = await (client as any).sendToDaemonViaQueue({
      type: 'HASH_TASKS_UPFRONT',
    });

    expect(response).toEqual({ hashes: {} });
    expect(restarts).toBe(1);
    // The reconnect wait is budgeted separately from a cold start's, so a
    // daemon that will never come back does not stall the command for a minute.
    expect(waitedWith[0].budget.maxAttempts).toBe(500);
  }, 20000);

  // A payload is flushed over several writes, so a peer that dies partway
  // through fails the write rather than merely closing the connection. That
  // error used to be classified as a daemon defect and end the command.
  it('treats a write that lands on a closed peer as recoverable', async () => {
    // Stops listening — which frees the socket path for the replacement — but
    // holds the connection open, so the failed write is the only signal the
    // client gets that the daemon is gone.
    await listen((_socket, server) => server.close());

    const client = buildClient();
    (client as any).waitForServerToBeAvailable = async () => ({
      available: false,
    });
    (client as any).startInBackground = async () => {
      await startHealthyDaemon();
      return 4242;
    };

    const pending = (client as any).sendToDaemonViaQueue({
      type: 'GET_ESTIMATED_TASK_TIMINGS',
    });
    await new Promise((r) => setTimeout(r, 50));
    (client as any).socketMessenger?.['socket'].emit(
      'error',
      Object.assign(new Error('write EPIPE'), {
        code: 'EPIPE',
        syscall: 'write',
      })
    );

    await expect(pending).resolves.toEqual({ hashes: {} });
  }, 20000);

  // A version the client can never match would otherwise restart and re-dial a
  // daemon for the life of the command.
  it('gives up once the restarts stop helping', async () => {
    await startOutdatedDaemon();

    const client = buildClient();
    (client as any).waitForServerToBeAvailable = async () => ({
      available: false,
    });
    let restarts = 0;
    (client as any).startInBackground = async () => {
      restarts++;
      await startOutdatedDaemon();
      return 4242;
    };

    await expect(
      (client as any).sendToDaemonViaQueue({ type: 'HASH_TASKS_UPFRONT' })
    ).rejects.toThrow('closed the connection');
    expect(restarts).toBe(3);
  }, 30000);
});
