import { rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

// Point the daemon log at a path this spec controls so both states — log
// missing (first run in a fresh environment) and log present — are reachable.
// The directory is unique per run so parallel jest workers cannot collide on it
// and no other user can pre-plant the path on a shared machine.
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

  // The regression this guards: the tag used to be set only inside the
  // try-block that reads the log, so a daemon that failed before ever writing
  // one produced an untagged error. createProjectGraphAndSourceMapsAsync keys
  // its daemonless fallback off that tag, so the command aborted instead of
  // degrading — worst exactly where the daemon is most likely to fail, such as
  // a first run in a sandbox that denies the socket bind.
  it('should still tag the error as internal when the daemon log is missing', () => {
    rmSync(logFile, { force: true });

    const error = daemonProcessException('Daemon failed');

    expect(error.message).toContain('Daemon failed');
    expect(error.message).not.toContain('Messages from the log');
    expect((error as any).internalDaemonError).toBe(true);
  });
});
