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
import { daemonProcessException } from './client';

describe('daemonProcessException', () => {
  afterEach(() => {
    rmSync(logFile, { force: true });
  });

  afterAll(() => {
    rmSync(dirname(logFile), { recursive: true, force: true });
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
