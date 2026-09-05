import type { Mock, MockInstance } from 'vitest';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

// Redirect the daemon log and its directory so both states — present and
// missing — are reachable, and so startInBackground creates nothing in the
// workspace. Unique per run so parallel workers cannot collide.
vi.mock('../tmp-dir', async () => {
  const actual = await vi.importActual('../tmp-dir');
  const { join: joinPath } = await import('node:path');
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir: osTmpDir } = await import('node:os');
  const daemonDir = mkdtempSync(joinPath(osTmpDir(), 'nx-spec-daemon-'));
  return {
    ...actual,
    DAEMON_DIR_FOR_CURRENT_WORKSPACE: daemonDir,
    DAEMON_OUTPUT_LOG_FILE: joinPath(daemonDir, 'daemon.log'),
  };
});

const daemonExit = vi.hoisted(() => ({ code: null as number | null }));

vi.mock('child_process', async () => ({
  ...require('child_process'),
  spawn: vi.fn(() => ({
    pid: 4242,
    unref: vi.fn(),
    // A daemon whose bind was refused exits before the poll gives up, so the
    // listener fires synchronously here rather than being left dangling.
    once: vi.fn((event: string, cb: (code: number | null) => void) => {
      if (event === 'exit' && daemonExit.code !== null) {
        cb(daemonExit.code);
      }
    }),
  })),
}));

vi.mock('../../utils/wait-for-socket-connection', () => ({
  waitForSocketConnection: vi.fn(),
}));

vi.mock('../logger', () => ({
  clientLogger: { log: vi.fn() },
}));

// Real by default — the probe tests below need a genuine connect errno — and
// replaced with a fake socket only where the close handler is under test.
vi.mock('net', async () => {
  const actual = await vi.importActual<typeof import('net')>('net');
  return { ...actual, connect: vi.fn(actual.connect) };
});

vi.mock('../cache', async () => ({
  ...(await vi.importActual('../cache')),
  readDaemonProcessJsonCache: vi.fn(),
  getDaemonProcessIdSync: vi.fn(() => undefined),
}));

import { EventEmitter } from 'node:events';
import { connect } from 'net';

import { waitForSocketConnection } from '../../utils/wait-for-socket-connection';
import { clientLogger } from '../logger';
import { getDaemonProcessIdSync, readDaemonProcessJsonCache } from '../cache';
import { DAEMON_OUTPUT_LOG_FILE as logFile } from '../tmp-dir';
import { SOCKET_REFUSED_EXIT_CODE } from '../../utils/socket-refused-exit-code';
import {
  DaemonClient,
  daemonClient,
  daemonPermissionException,
  daemonProcessException,
  DaemonStatus,
} from './client';
import { VersionMismatchError } from './daemon-socket-messenger';

declare global {
  // eslint-disable-next-line no-var
  var NX_PLUGIN_WORKER: boolean | undefined;
}

type TestClient = {
  _daemonStatus: DaemonStatus;
  _waitForDaemonReady: Promise<void> | null;
  _daemonReady: (() => void) | null;
  _pluginWorkerConnectionLost: Error | null;
  currentMessage: unknown;
  currentResolve: ((v: unknown) => void) | null;
  currentReject: ((e: unknown) => void) | null;
  startDaemonIfNecessary: () => Promise<void>;
  handleConnectionError: (err: Error) => Promise<void>;
  probeServer: () => Promise<{ available: boolean; refusal?: unknown }>;
  startInBackground: (probeRefusal?: unknown) => Promise<number>;
  setUpConnection: () => void;
  waitForServerToBeAvailable: (opts: {
    ignoreVersionMismatch: boolean;
  }) => Promise<{ available: boolean; refusal?: unknown }>;
  establishConnection: () => void;
  registerDaemonProcessWithMetricsService: (
    pid: number | null
  ) => Promise<void>;
};

function asTest(client: DaemonClient): TestClient {
  return client as unknown as TestClient;
}

type FakeSocket = EventEmitter & {
  unref: Mock;
  write: Mock;
  destroy: Mock;
};

// Lets `setUpConnection` run for real, so the close handler under test is the
// one production installs. Only the members that handler's path touches exist.
function createFakeSocket(): FakeSocket {
  return Object.assign(new EventEmitter(), {
    unref: vi.fn(),
    write: vi.fn(),
    destroy: vi.fn(),
  });
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

// Both suites share the mocked log path, so the directory is torn down once at
// the end rather than by whichever suite finishes first.
afterAll(() => {
  rmSync(dirname(logFile), { recursive: true, force: true });
});

describe('daemonProcessException', () => {
  afterEach(() => {
    rmSync(logFile, { force: true });
  });

  it('should append the tail of the daemon log when one exists', () => {
    writeFileSync(logFile, 'something went wrong in the daemon');

    const error = daemonProcessException('Daemon failed');

    expect(error.message).toContain('Daemon failed');
    expect(error.message).toContain('something went wrong in the daemon');
    expect((error as any).internalDaemonError).toBe(true);
  });

  // The tag used to be set only inside the try that reads the log, so a daemon
  // failing before writing one produced an untagged error and the daemonless
  // fallback never fired.
  it('should still tag the error as internal when the daemon log is missing', () => {
    rmSync(logFile, { force: true });

    const error = daemonProcessException('Daemon failed');

    expect(error.message).toContain('Daemon failed');
    expect(error.message).not.toContain('Messages from the log');
    expect((error as any).internalDaemonError).toBe(true);
  });
});

describe('daemonPermissionException', () => {
  const socketPath = '/tmp/.nx/1001/sockets/abc123/d.sock';

  afterEach(() => {
    rmSync(logFile, { force: true });
  });

  // The 0700 directory turns "connected to someone else's daemon" into a
  // refused connect, so this is the fix working. Tagging it internal would tell
  // the user to file an issue and disable the daemon until `nx reset`, which
  // outlives the stale socket that caused it.
  it('should not classify a refused connection as an internal daemon error', () => {
    const error = daemonPermissionException(socketPath, 'connect EPERM');

    expect((error as any).daemonPermissionError).toBe(true);
    expect((error as any).internalDaemonError).toBeUndefined();
  });

  it('should name the socket and both ways out of it', () => {
    const error = daemonPermissionException(socketPath, 'connect EACCES');

    expect(error.message).toContain(socketPath);
    expect(error.message).toContain('connect EACCES');
    expect(error.message).toContain('different user');
    expect(error.message).toContain('NX_SOCKET_DIR');
  });

  // The KB page attributes connect-not-create to Claude Code's
  // `allowUnixSockets`, not to scoped allowlists at large, so the clause naming
  // the limitation has to name Claude Code in the same breath.
  it('should point a sandboxed user at the generator, not at a blanket grant', () => {
    // Measured on Claude Code 2.1.241: the scoped `allowUnixSockets` entry
    // permits binding, so `allowAllUnixSockets` buys nothing for Nx and opens
    // every socket on the machine. Each agent gates sockets on a different
    // setting, so the message names the generator and the KB page rather than
    // one agent's key.
    const { message } = daemonPermissionException(socketPath, 'connect EPERM');

    expect(message).toContain('allow unix sockets under the Nx socket root');
    expect(message).toContain('nx configure-ai-agents');
    expect(message).toContain('https://nx.dev/docs/kb/nx-sandbox-unix-sockets');
    expect(message).not.toContain('allowAllUnixSockets');
  });

  // The errno has to be on the first line specifically, not merely somewhere in
  // the message: createProjectGraphAndSourceMapsAsync renders this as an
  // output.note using line 0 as the title and the rest as bodyLines. It is also
  // the only thing separating EACCES (someone else's socket, delete it) from
  // EPERM (a sandbox refusing the connect), and that branch writes no daemon
  // log, so a message that buries the errno lower down loses it entirely.
  it.each(['connect EACCES', 'connect EPERM'])(
    'should put %s on the first line, where the rendered note uses it',
    (cause: string) => {
      const [summary] = daemonPermissionException(
        socketPath,
        cause
      ).message.split('\n');

      expect(summary).toContain(cause);
    }
  );

  it('should not quote our daemon log, which belongs to a different process', () => {
    writeFileSync(logFile, 'something went wrong in the daemon');

    const error = daemonPermissionException(socketPath, 'connect EPERM');

    expect(error.message).not.toContain('Messages from the log');
    expect(error.message).not.toContain('something went wrong in the daemon');
  });
});

// The constructors above were the only thing covered, which is how a call site
// that throws before it can report shipped: the branch, the errno it reads and
// the path it names are all here.
describe('startInBackground', () => {
  const refusedSocket = '/tmp/.nx/1001/sockets/abc123/d.sock';

  const refuse = (code: string) =>
    (waitForSocketConnection as Mock).mockImplementation(
      (_socketPath, options) => {
        options?.onConnectError?.(
          Object.assign(new Error(`connect ${code} ${refusedSocket}`), {
            code,
          }),
          refusedSocket
        );
        return null;
      }
    );

  beforeEach(() => {
    daemonClient.reset();
    (readDaemonProcessJsonCache as Mock).mockReturnValue({
      socketPath: refusedSocket,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    daemonExit.code = null;
    rmSync(logFile, { force: true });
  });

  it.each(['EACCES', 'EPERM'])(
    'should report a %s refusal as a permission problem rather than an internal daemon failure',
    async (code: string) => {
      refuse(code);

      const error = await daemonClient.startInBackground().catch((e) => e);

      // internalDaemonError is what tells the user to file an issue and
      // disables the daemon until `nx reset`, which outlives the stale socket
      // or the sandbox rule that caused this.
      expect((error as any).daemonPermissionError).toBe(true);
      expect((error as any).internalDaemonError).toBeUndefined();
      expect(error.message).toContain(code);
      expect(error.message).toContain(refusedSocket);
    }
  );

  // The flagship case. A daemon that cannot bind shuts down, and performShutdown
  // unlinks the process json on its way out — so by the time this is reported
  // there is no socket path left to look up, and anything that tries throws
  // daemonProcessException from inside the argument list, replacing the
  // diagnosis with the one it exists to avoid.
  it('should still name the socket when the daemon removed its process json', async () => {
    refuse('EACCES');
    (readDaemonProcessJsonCache as Mock).mockReturnValue(undefined);

    const error = await daemonClient.startInBackground().catch((e) => e);

    expect((error as any).daemonPermissionError).toBe(true);
    expect((error as any).internalDaemonError).toBeUndefined();
    expect(error.message).toContain(refusedSocket);
  });

  it('should leave an ordinary startup failure classified as internal', async () => {
    refuse('ENOENT');

    const error = await daemonClient.startInBackground().catch((e) => e);

    expect((error as any).internalDaemonError).toBe(true);
    expect((error as any).daemonPermissionError).toBeUndefined();
  });

  // The daemon binds in a detached child, so a refusal reaches the client only
  // as a missing socket — ENOENT, which is also what a cold start looks like.
  // The child's exit code is the only way that errno crosses the process
  // boundary, and it is the sole evidence available under an agent whose
  // sandbox `isSandbox()` cannot see, such as Copilot CLI.
  it('should surface socket guidance when the daemon exits having been refused its bind', async () => {
    refuse('ENOENT');
    daemonExit.code = SOCKET_REFUSED_EXIT_CODE;

    const error = await daemonClient.startInBackground().catch((e) => e);

    expect(error.message).toContain('denied permission');
    expect(error.message).toContain('NX_SOCKET_DIR');
  });

  it('should stay quiet about sockets when the daemon died for some other reason', async () => {
    // An OOM kill or a broken install exits non-zero too; only the refusal code
    // means the operating system said no.
    refuse('ENOENT');
    daemonExit.code = 1;

    const error = await daemonClient.startInBackground().catch((e) => e);

    expect(error.message).not.toContain('NX_SOCKET_DIR');
  });

  // A refusal describes one startup attempt. Retained across a reset it would
  // misdiagnose the next command in the same process.
  it('should not carry a refusal from an earlier attempt into a later one', async () => {
    refuse('EACCES');
    await daemonClient.startInBackground().catch((e) => e);

    daemonClient.reset();
    (waitForSocketConnection as Mock).mockResolvedValue(null);
    const error = await daemonClient.startInBackground().catch((e) => e);

    expect((error as any).daemonPermissionError).toBeUndefined();
    expect((error as any).internalDaemonError).toBe(true);
  });

  // Two polls in flight at once. The reconnect paths guard themselves with
  // their own separate flags, so a file-watcher reconnect, a project-graph
  // listener reconnect and a startup poll are not mutually exclusive. While the
  // refusal lived in one instance field, whichever wrote last won and the
  // startup could report a socket path belonging to someone else's attempt.
  it('should not report a refusal belonging to a concurrent poll', async () => {
    const polls: Array<{ options: any; resolve: (v: null) => void }> = [];
    (waitForSocketConnection as Mock).mockImplementation(
      (_socketPath, options) =>
        new Promise<null>((resolve) => polls.push({ options, resolve }))
    );

    const startup = daemonClient.startInBackground().catch((e) => e);
    const competing = (daemonClient as any).waitForServerToBeAvailable({
      ignoreVersionMismatch: false,
    });
    expect(polls).toHaveLength(2);

    // The startup poll is refused first; the other poll is refused after, with
    // a different socket. The startup must still report its own.
    polls[0].options.onConnectError(
      Object.assign(new Error('connect EACCES /mine.sock'), { code: 'EACCES' }),
      '/mine.sock'
    );
    polls[1].options.onConnectError(
      Object.assign(new Error('connect EPERM /theirs.sock'), { code: 'EPERM' }),
      '/theirs.sock'
    );
    polls[0].resolve(null);

    const error = await startup;
    expect(error.message).toContain('/mine.sock');
    expect(error.message).not.toContain('/theirs.sock');

    polls[1].resolve(null);
    await competing;
  });

  // The other half of the same rule: an errno the caller's probe produced does
  // belong to this attempt, and the poll cannot reproduce it once the daemon
  // that refused us has unlinked its process json. Without it a sandbox
  // refusing connects degrades to a generic startup failure.
  it('should report the errno its caller probed with when the poll produces none', async () => {
    (waitForSocketConnection as Mock).mockResolvedValue(null);
    (readDaemonProcessJsonCache as Mock).mockReturnValue(undefined);

    const error = await daemonClient
      .startInBackground({
        error: Object.assign(new Error('connect EPERM'), { code: 'EPERM' }),
        socketPath: refusedSocket,
      })
      .catch((e) => e);

    expect((error as any).daemonPermissionError).toBe(true);
    expect(error.message).toContain(refusedSocket);
  });

  // The log line keys on the early exit actually taken. Every failed connect
  // records an errno — including the ENOENT of an ordinary cold start, which is
  // the "daemon died, restarting" path support asks users about — while only a
  // permission errno stops the loop. Keying on the recorded value reported
  // "refused, stopped polling" for a poll nobody refused.
  it.each([
    ['ENOENT', 'not available after'],
    ['EACCES', 'refused the connection'],
  ])(
    'should describe a poll that ended on %s by how it actually ended',
    async (code: string, expected: string) => {
      refuse(code);

      await daemonClient.startInBackground().catch((e) => e);

      const logged = (clientLogger.log as Mock).mock.calls
        .map((c) => String(c[0]))
        .join('\n');
      expect(logged).toContain(expected);
    }
  );

  // The only test that produces a ConnectRefusal the way production does. Every
  // other one hands `startInBackground` an object built by hand, which covers
  // the callee's contract but not the hand-off that feeds it: deleting the
  // argument at the `startDaemonIfNecessary` call site left the whole suite
  // green. Here the errno comes from the kernel — a directory with no search
  // permission makes connect() fail EACCES — travels through `probeServer`, and
  // has to arrive at the classification.
  const rootlessPosix =
    process.platform === 'win32' || process.getuid?.() === 0 ? it.skip : it;

  rootlessPosix(
    'should carry a real probe refusal from probeServer into the report',
    async () => {
      const base = mkdtempSync(join(tmpdir(), 'nx-spec-handoff-'));
      const locked = join(base, 'locked');
      mkdirSync(locked);
      chmodSync(locked, 0o000);
      const socketPath = join(locked, 'd.sock');
      (readDaemonProcessJsonCache as Mock).mockReturnValue({ socketPath });
      // The poll reports nothing, so the probe's errno is the only one there is.
      (waitForSocketConnection as Mock).mockResolvedValue(null);

      try {
        daemonClient.reset();
        const error = await (daemonClient as any)
          .startDaemonIfNecessary()
          .catch((e: any) => e);

        expect((error as any).daemonPermissionError).toBe(true);
        expect(error.message).toContain(socketPath);
      } finally {
        chmodSync(locked, 0o700);
        rmSync(base, { recursive: true, force: true });
      }
    }
  );

  rootlessPosix(
    'should not hand on a refusal from an earlier round when the probe records none',
    async () => {
      const base = mkdtempSync(join(tmpdir(), 'nx-spec-stale-'));
      const locked = join(base, 'locked');
      mkdirSync(locked);
      chmodSync(locked, 0o000);
      (readDaemonProcessJsonCache as Mock).mockReturnValue({
        socketPath: join(locked, 'd.sock'),
      });
      (waitForSocketConnection as Mock).mockResolvedValue(null);

      try {
        daemonClient.reset();
        await (daemonClient as any).startDaemonIfNecessary().catch((e) => e);

        // By hand, not via reset(): reset() would clear any instance-held
        // refusal, which is exactly the regression this checks for.
        (readDaemonProcessJsonCache as Mock).mockReturnValue(undefined);
        (daemonClient as any)._daemonStatus = DaemonStatus.DISCONNECTED;
        const error = await (daemonClient as any)
          .startDaemonIfNecessary()
          .catch((e: any) => e);

        expect((error as any).daemonPermissionError).toBeUndefined();
        expect((error as any).internalDaemonError).toBe(true);
      } finally {
        chmodSync(locked, 0o700);
        rmSync(base, { recursive: true, force: true });
      }
    }
  );

  // The same staleness as the reset test above, without a reset in between.
  // When the process json is absent for the whole poll the resolver returns
  // null every tick, so tryConnect never runs and onConnectError never fires —
  // nothing overwrites the previous round's errno. The user is then told to
  // delete a socket that does not exist, for an attempt that never happened.
  it('should not report a refusal the current attempt never produced', async () => {
    refuse('EACCES');
    await daemonClient.startInBackground().catch((e) => e);

    // No reset, and the poll never reports an errno: with the process json
    // absent the resolver returns null every tick, so tryConnect is not called
    // and onConnectError does not fire. Nothing overwrites the previous value.
    (readDaemonProcessJsonCache as Mock).mockReturnValue(undefined);
    (waitForSocketConnection as Mock).mockResolvedValue(null);
    const error = await daemonClient.startInBackground().catch((e) => e);

    expect((error as any).daemonPermissionError).toBeUndefined();
    expect((error as any).internalDaemonError).toBe(true);
  });
});

describe('DaemonClient state machine', () => {
  let daemon: DaemonClient;
  let client: TestClient;

  beforeEach(() => {
    daemon = new DaemonClient();
    client = asTest(daemon);
    // Never actually register with metrics during tests.
    vi.spyOn(
      client as unknown as { registerDaemonProcessWithMetricsService: any },
      'registerDaemonProcessWithMetricsService'
    ).mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete global.NX_PLUGIN_WORKER;
    vi.restoreAllMocks();
  });

  describe('startDaemonIfNecessary()', () => {
    it('does not wedge concurrent callers when the initial connect throws', async () => {
      const err = new Error('spawn failed');
      vi.spyOn(client, 'probeServer').mockResolvedValue({ available: false });
      vi.spyOn(client, 'startInBackground').mockRejectedValue(err);

      // Kick off caller A synchronously; it flips status DISCONNECTED -> CONNECTING.
      const first = client.startDaemonIfNecessary();
      // Caller B now enters the CONNECTING branch and awaits _waitForDaemonReady.
      const second = client.startDaemonIfNecessary();

      await expect(first).rejects.toThrow('spawn failed');
      await expect(second).rejects.toThrow('spawn failed');

      // A failed attempt must leave the client DISCONNECTED so the next
      // caller can retry instead of parking on a pending promise forever.
      expect(client._daemonStatus).toBe(DaemonStatus.DISCONNECTED);
    });

    it('lets a future caller retry after a failed connect attempt', async () => {
      const err = new Error('spawn failed');
      const probeServer = vi
        .spyOn(client, 'probeServer')
        .mockResolvedValue({ available: false });
      const startInBackground = vi
        .spyOn(client, 'startInBackground')
        .mockRejectedValueOnce(err)
        .mockResolvedValueOnce(1234);
      vi.spyOn(client, 'setUpConnection').mockImplementation(() => {
        /* no-op */
      });

      await expect(client.startDaemonIfNecessary()).rejects.toThrow(
        'spawn failed'
      );
      expect(client._daemonStatus).toBe(DaemonStatus.DISCONNECTED);

      await expect(client.startDaemonIfNecessary()).resolves.toBeUndefined();
      expect(client._daemonStatus).toBe(DaemonStatus.CONNECTED);
      expect(probeServer).toHaveBeenCalledTimes(2);
      expect(startInBackground).toHaveBeenCalledTimes(2);
    });

    // Metrics registration happens after the connection is established, so a
    // throw there must not send an already-CONNECTED client back to
    // DISCONNECTED.
    it('keeps an established connection when the metrics lookup throws', async () => {
      vi.spyOn(client, 'probeServer').mockResolvedValue({ available: false });
      vi.spyOn(client, 'startInBackground').mockResolvedValue(undefined);
      vi.spyOn(client, 'setUpConnection').mockImplementation(() => {
        /* no-op */
      });
      (getDaemonProcessIdSync as Mock).mockImplementationOnce(() => {
        throw new Error('no process json');
      });

      await expect(client.startDaemonIfNecessary()).rejects.toThrow(
        'no process json'
      );
      expect(client._daemonStatus).toBe(DaemonStatus.CONNECTED);
    });
  });

  // Production reaches handleConnectionError only through the close handler
  // `setUpConnection` installs, by which point the connect has already set
  // CONNECTED and resolved the ready promise. So the whole sequence is driven
  // here — connect, send, lose the socket — rather than calling the handler on
  // a fresh client, which starts from a state production never reaches.
  describe('a plugin worker losing its daemon connection', () => {
    let socket: FakeSocket;
    let probeServer: MockInstance;
    let startInBackground: MockInstance;
    let waitForServerToBeAvailable: MockInstance;

    beforeEach(async () => {
      global.NX_PLUGIN_WORKER = true;
      socket = createFakeSocket();
      (connect as Mock).mockReturnValue(socket);
      (readDaemonProcessJsonCache as Mock).mockReturnValue({
        socketPath: '/tmp/nx-spec-plugin-worker/d.sock',
      });
      probeServer = vi
        .spyOn(client, 'probeServer')
        .mockResolvedValue({ available: true });
      // Left calling through: the real ones are what a reconnect attempt would
      // hit, and neither may be reached again after the connection is lost.
      startInBackground = vi.spyOn(client, 'startInBackground');
      waitForServerToBeAvailable = vi.spyOn(
        client,
        'waitForServerToBeAvailable'
      );

      await client.startDaemonIfNecessary();
      expect(client._daemonStatus).toBe(DaemonStatus.CONNECTED);
    });

    afterEach(async () => {
      const actual = await vi.importActual<typeof import('net')>('net');
      (connect as Mock).mockImplementation(actual.connect);
    });

    it('fails the in-flight message rather than polling for a replacement daemon', async () => {
      const inFlight = daemon.requestShutdown();
      // Let the queue put the message on the socket, so the close below lands
      // on a client with work in flight.
      await tick();

      socket.emit('close');

      await expect(inFlight).rejects.toThrow(
        /Plugin worker lost its daemon connection/
      );
      expect(waitForServerToBeAvailable).not.toHaveBeenCalled();
    });

    it('fails later messages with the plugin-worker error even though a daemon is reachable', async () => {
      const inFlight = daemon.requestShutdown();
      await tick();
      socket.emit('close');
      await expect(inFlight).rejects.toThrow(/Plugin worker/);
      probeServer.mockClear();

      // The gate every queued and future message awaits before it reaches the
      // socket. Without the guard the reachable daemon is connected to and the
      // worker carries on against a daemon it never asked for.
      await expect(client.startDaemonIfNecessary()).rejects.toThrow(
        /Plugin worker lost its daemon connection/
      );
      expect(probeServer).not.toHaveBeenCalled();
      expect(client._daemonStatus).toBe(DaemonStatus.DISCONNECTED);
    });

    it('fails later messages with the plugin-worker error, not the startInBackground guard, when no daemon is reachable', async () => {
      const inFlight = daemon.requestShutdown();
      await tick();
      socket.emit('close');
      await expect(inFlight).rejects.toThrow(/Plugin worker/);
      probeServer.mockResolvedValue({ available: false });

      const error = await daemon.requestShutdown().catch((e) => e);

      expect(error.message).toContain(
        'Plugin worker lost its daemon connection'
      );
      // What the message got before: startInBackground's guard text, which
      // tells the user to report a bug they did not hit.
      expect(error.message).not.toContain('Please report this issue');
      expect(startInBackground).not.toHaveBeenCalled();
    });
  });

  describe('handleConnectionError() when the reconnect never succeeds', () => {
    it('surfaces the original error to the in-flight message and to concurrent callers', async () => {
      vi.spyOn(client, 'waitForServerToBeAvailable').mockResolvedValue({
        available: false,
      });
      const currentReject = vi.fn();
      client.currentReject = currentReject;
      const error = new Error('daemon gone');

      const settle = client.handleConnectionError(error);
      // handleConnectionError installs its own ready promise before its first
      // await; that is the one concurrent callers park on.
      const newReady = client._waitForDaemonReady!;

      await settle;

      await expect(newReady).rejects.toBe(error);
      expect(currentReject).toHaveBeenCalledWith(error);
      expect(client._daemonStatus).toBe(DaemonStatus.DISCONNECTED);
    });
  });

  describe('handleConnectionError() with a version mismatch on reconnect', () => {
    it('surfaces the error to concurrent callers awaiting _waitForDaemonReady', async () => {
      vi.spyOn(client, 'waitForServerToBeAvailable').mockRejectedValue(
        new VersionMismatchError()
      );
      const currentReject = vi.fn();
      client.currentReject = currentReject;

      // Drive handleConnectionError; it will create a new _waitForDaemonReady
      // and replace the existing reference. Grab that new one after the fact.
      const settle = client.handleConnectionError(new Error('daemon gone'));
      // Wait for it to create the new promise; handleConnectionError is
      // synchronous up to the first await.
      const newReady = client._waitForDaemonReady!;

      await settle;

      await expect(newReady).rejects.toBeInstanceOf(VersionMismatchError);
      expect(client._daemonStatus).toBe(DaemonStatus.DISCONNECTED);
      expect(currentReject).toHaveBeenCalledWith(
        expect.any(VersionMismatchError)
      );
    });
  });
});
