import type { Mock } from 'vitest';
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

vi.mock('child_process', async () => ({
  ...require('child_process'),
  spawn: vi.fn(() => ({ pid: 4242, unref: vi.fn() })),
}));

vi.mock('../../utils/wait-for-socket-connection', () => ({
  waitForSocketConnection: vi.fn(),
}));

vi.mock('../logger', () => ({
  clientLogger: { log: vi.fn() },
}));

vi.mock('../cache', async () => ({
  ...(await vi.importActual('../cache')),
  readDaemonProcessJsonCache: vi.fn(),
  getDaemonProcessIdSync: vi.fn(() => undefined),
}));

import { waitForSocketConnection } from '../../utils/wait-for-socket-connection';
import { clientLogger } from '../logger';
import { readDaemonProcessJsonCache } from '../cache';
import { DAEMON_OUTPUT_LOG_FILE as logFile } from '../tmp-dir';
import {
  daemonClient,
  daemonPermissionException,
  daemonProcessException,
} from './client';

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
  it('should scope the allowAllUnixSockets advice to Claude Code', () => {
    const { message } = daemonPermissionException(socketPath, 'connect EPERM');

    expect(message).toContain('allow unix sockets under the Nx socket root');
    expect(message).toContain(
      'in Claude Code a scoped `allowUnixSockets` only permits connecting'
    );
    expect(message).toContain('allowAllUnixSockets: true');
    expect(message).toContain('https://nx.dev/docs/kb/nx-sandbox-unix-sockets');
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
        (daemonClient as any)._daemonStatus = 1; // DISCONNECTED
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
