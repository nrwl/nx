import { existsSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { cleanupStaleSocketFile, isWindows } from './socket-utils';

describe('cleanupStaleSocketFile', () => {
  let tempSocketPath: string;

  beforeEach(() => {
    tempSocketPath = join(
      tmpdir(),
      `nx-test-socket-${process.pid}-${Date.now()}.sock`
    );
  });

  afterEach(() => {
    try {
      unlinkSync(tempSocketPath);
    } catch {}
  });

  it('should remove an existing socket file', () => {
    if (isWindows) {
      return; // Named pipes are managed by the OS on Windows
    }
    writeFileSync(tempSocketPath, '');
    expect(existsSync(tempSocketPath)).toBe(true);

    cleanupStaleSocketFile(tempSocketPath);

    expect(existsSync(tempSocketPath)).toBe(false);
  });

  it('should not throw if the socket file does not exist', () => {
    expect(() => {
      cleanupStaleSocketFile(tempSocketPath);
    }).not.toThrow();
  });

  it('should not throw for an empty path', () => {
    expect(() => {
      cleanupStaleSocketFile('');
    }).not.toThrow();
  });

  it('should not throw if the path is a directory', () => {
    // Attempting to unlink a directory will throw EISDIR/EPERM,
    // but cleanupStaleSocketFile should swallow the error.
    expect(() => {
      cleanupStaleSocketFile(tmpdir());
    }).not.toThrow();
  });
});
