import { rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

// Redirect the daemon log and its directory so both states — present and
// missing — are reachable, and so startInBackground creates nothing in the
// workspace. Unique per run so parallel workers cannot collide.
jest.mock('../tmp-dir', () => {
  const actual = jest.requireActual('../tmp-dir');
  const { join: joinPath } = require('node:path');
  const { mkdtempSync } = require('node:fs');
  const { tmpdir: osTmpDir } = require('node:os');
  const daemonDir = mkdtempSync(joinPath(osTmpDir(), 'nx-spec-daemon-'));
  return {
    ...actual,
    DAEMON_DIR_FOR_CURRENT_WORKSPACE: daemonDir,
    DAEMON_OUTPUT_LOG_FILE: joinPath(daemonDir, 'daemon.log'),
  };
});

jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  spawn: jest.fn(() => ({ pid: 4242, unref: jest.fn() })),
}));

jest.mock('../../utils/wait-for-socket-connection', () => ({
  waitForSocketConnection: jest.fn(),
}));

jest.mock('../cache', () => ({
  ...jest.requireActual('../cache'),
  readDaemonProcessJsonCache: jest.fn(),
  getDaemonProcessIdSync: jest.fn(() => undefined),
}));

import { waitForSocketConnection } from '../../utils/wait-for-socket-connection';
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
    (waitForSocketConnection as jest.Mock).mockImplementation(
      async (_socketPath, options) => {
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
    (readDaemonProcessJsonCache as jest.Mock).mockReturnValue({
      socketPath: refusedSocket,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
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
    (readDaemonProcessJsonCache as jest.Mock).mockReturnValue(undefined);

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
    (waitForSocketConnection as jest.Mock).mockResolvedValue(null);
    const error = await daemonClient.startInBackground().catch((e) => e);

    expect((error as any).daemonPermissionError).toBeUndefined();
    expect((error as any).internalDaemonError).toBe(true);
  });

  // The same staleness without a reset in between. When the process json is
  // absent for the whole poll the resolver returns null every tick, so
  // tryConnect never runs and onConnectError never fires — nothing overwrites
  // the previous round's errno and nothing clears it. The user is then told to
  // delete a socket that does not exist, for an attempt that never happened.
  // The other half of the same rule: an errno the caller's probe produced does
  // belong to this attempt, and the poll cannot reproduce it once the daemon
  // that refused us has unlinked its process json. Without it a sandbox
  // refusing connects degrades to a generic startup failure.
  it('should report the errno its caller probed with when the poll produces none', async () => {
    (waitForSocketConnection as jest.Mock).mockResolvedValue(null);
    (readDaemonProcessJsonCache as jest.Mock).mockReturnValue(undefined);

    const error = await daemonClient
      .startInBackground({
        error: Object.assign(new Error('connect EPERM'), { code: 'EPERM' }),
        socketPath: refusedSocket,
      })
      .catch((e) => e);

    expect((error as any).daemonPermissionError).toBe(true);
    expect(error.message).toContain(refusedSocket);
  });

  it('should not report a refusal the current attempt never produced', async () => {
    refuse('EACCES');
    await daemonClient.startInBackground().catch((e) => e);

    // No reset, and the poll never reports an errno: with the process json
    // absent the resolver returns null every tick, so tryConnect is not called
    // and onConnectError does not fire. Nothing overwrites the previous value.
    (readDaemonProcessJsonCache as jest.Mock).mockReturnValue(undefined);
    (waitForSocketConnection as jest.Mock).mockResolvedValue(null);
    const error = await daemonClient.startInBackground().catch((e) => e);

    expect((error as any).daemonPermissionError).toBeUndefined();
    expect((error as any).internalDaemonError).toBe(true);
  });
});
