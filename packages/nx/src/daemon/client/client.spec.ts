import { rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

// Redirect the daemon log so both states — present and missing — are reachable.
// Unique per run so parallel workers cannot collide.
jest.mock('../tmp-dir', () => {
  const actual = jest.requireActual('../tmp-dir');
  const { join: joinPath } = require('node:path');
  const { mkdtempSync } = require('node:fs');
  const { tmpdir: osTmpDir } = require('node:os');
  return {
    ...actual,
    DAEMON_OUTPUT_LOG_FILE: joinPath(
      mkdtempSync(joinPath(osTmpDir(), 'nx-spec-daemon-')),
      'daemon.log'
    ),
  };
});

import { DAEMON_OUTPUT_LOG_FILE as logFile } from '../tmp-dir';
import { daemonPermissionException, daemonProcessException } from './client';

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
