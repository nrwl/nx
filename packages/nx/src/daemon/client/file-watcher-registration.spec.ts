import { randomBytes } from 'crypto';
import { createServer, Server, Socket } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  consumeMessagesFromSocket,
  parseMessage,
  writeMessage,
} from '../../utils/consume-messages-from-socket';
import { serialize } from '../socket-utils';
import { DaemonClient } from './client';

describe('file watcher registration readiness', () => {
  let server: Server;
  let client: DaemonClient;
  let sockets: Set<Socket>;
  let registrations: { socket: Socket; registrationId: string }[];

  beforeEach(async () => {
    sockets = new Set();
    registrations = [];
    const socketPath = join(
      tmpdir(),
      `nx-watch-ready-${randomBytes(6).toString('hex')}.sock`
    );
    server = createServer((socket) => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
      socket.on(
        'data',
        consumeMessagesFromSocket((data) => {
          const message = parseMessage<any>(data);
          if (message.type === 'REGISTER_FILE_WATCHER') {
            registrations.push({
              socket,
              registrationId: message.registrationId,
            });
          }
        })
      );
    });
    await new Promise<void>((resolve) => server.listen(socketPath, resolve));
    client = new DaemonClient();
    vi.spyOn(client, 'getProjectGraphAndSourceMaps').mockResolvedValue(
      {} as any
    );
    vi.spyOn(client as any, 'startDaemonIfNecessary').mockResolvedValue(
      undefined
    );
    vi.spyOn(client as any, 'getSocketPath').mockReturnValue(socketPath);
  });

  afterEach(async () => {
    // Prevent teardown's intentional socket close from starting a reconnect.
    (client as any).fileWatcherCallbacks.clear();
    (client as any).fileWatcherConfigs.clear();
    (client as any).fileWatcherMessenger?.close();
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    vi.restoreAllMocks();
  });

  function acknowledge(index: number) {
    const { socket, registrationId } = registrations[index];
    writeMessage(
      socket,
      serialize({ type: 'FILE_WATCHER_REGISTERED', registrationId }, 'json')
    );
  }

  it('rejects a pending registration when the daemon disconnects', async () => {
    const registration = client.registerFileWatcher(
      { watchProjects: 'all' },
      vi.fn()
    );
    const rejected = expect(registration).rejects.toThrow(
      'Daemon disconnected before watcher registration completed'
    );
    await vi.waitFor(() => expect(registrations).toHaveLength(1));
    registrations[0].socket.destroy();
    await rejected;
    expect((client as any).fileWatcherRegistrations.size).toBe(0);
    expect((client as any).fileWatcherCallbacks.size).toBe(0);
    expect((client as any).fileWatcherConfigs.size).toBe(0);
  });

  it('rejects a pending registration when the client resets', async () => {
    const registration = client.registerFileWatcher(
      { watchProjects: 'all' },
      vi.fn()
    );
    const rejected = expect(registration).rejects.toThrow(
      'Daemon client reset'
    );
    await vi.waitFor(() => expect(registrations).toHaveLength(1));
    client.reset();
    await rejected;
    expect((client as any).fileWatcherRegistrations.size).toBe(0);
  });

  it('times out and removes a registration that is never acknowledged', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const registration = client.registerFileWatcher(
        { watchProjects: 'all' },
        vi.fn()
      );
      const rejected = expect(registration).rejects.toThrow(
        'Timed out waiting for daemon watcher registration'
      );
      await vi.waitFor(() => expect(registrations).toHaveLength(1));
      await vi.advanceTimersByTimeAsync(60000);
      await rejected;
      expect((client as any).fileWatcherRegistrations.size).toBe(0);
      expect((client as any).fileWatcherCallbacks.size).toBe(0);
      expect((client as any).fileWatcherConfigs.size).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('delivers file changes after acknowledging registration', async () => {
    const callback = vi.fn();
    const registration = client.registerFileWatcher(
      { watchProjects: 'all' },
      callback
    );
    await vi.waitFor(() => expect(registrations).toHaveLength(1));
    acknowledge(0);
    await registration;
    const changes = { changedProjects: ['app'], changedFiles: [] };
    writeMessage(registrations[0].socket, serialize(changes, 'json'));
    await vi.waitFor(() =>
      expect(callback).toHaveBeenCalledWith(null, changes)
    );
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('rejects a new registration if a reconnected socket closes', async () => {
    vi.spyOn(client as any, 'waitForServerToBeAvailable').mockResolvedValue({
      available: true,
    });
    const first = client.registerFileWatcher(
      { watchProjects: ['first'] },
      vi.fn()
    );
    await vi.waitFor(() => expect(registrations).toHaveLength(1));
    acknowledge(0);
    const unregisterFirst = await first;
    registrations[0].socket.destroy();
    await vi.waitFor(() => expect(registrations).toHaveLength(2));
    const second = client.registerFileWatcher(
      { watchProjects: ['second'] },
      vi.fn()
    );
    const rejected = expect(second).rejects.toThrow(
      'Daemon disconnected before watcher registration completed'
    );
    await vi.waitFor(() => expect(registrations).toHaveLength(3));
    unregisterFirst();
    registrations[2].socket.destroy();
    await rejected;
    expect((client as any).fileWatcherRegistrations.size).toBe(0);
  });

  it('waits for the daemon to register the socket before reporting readiness', async () => {
    const callback = vi.fn();
    let ready = false;
    const registration = client
      .registerFileWatcher({ watchProjects: 'all' }, callback)
      .then((unregister) => {
        ready = true;
        return unregister;
      });

    await vi.waitFor(() => expect(registrations).toHaveLength(1));
    // The real socket delivered registration, but the server has not installed
    // the subscription yet. A caller must not start changing files here.
    const readyBeforeAcknowledgement = ready;
    acknowledge(0);
    const unregister = await registration;

    expect(readyBeforeAcknowledgement).toBe(false);
    expect(ready).toBe(true);
    expect(callback).not.toHaveBeenCalled();
    unregister();
  });

  it('also waits when adding a watcher to an existing connection', async () => {
    const first = client.registerFileWatcher(
      { watchProjects: ['first'] },
      vi.fn()
    );
    await vi.waitFor(() => expect(registrations).toHaveLength(1));
    acknowledge(0);
    await first;

    let ready = false;
    const second = client
      .registerFileWatcher({ watchProjects: ['second'] }, vi.fn())
      .then(() => {
        ready = true;
      });
    await vi.waitFor(() => expect(registrations).toHaveLength(2));
    const readyBeforeAcknowledgement = ready;
    acknowledge(1);
    await second;

    expect(readyBeforeAcknowledgement).toBe(false);
  });
});
