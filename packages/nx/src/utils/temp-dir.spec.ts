import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname } from 'node:path';
import { createTempDir } from './temp-dir';

describe('createTempDir', () => {
  it('creates a unique directory under the OS temp dir', () => {
    const { dir, cleanup } = createTempDir();
    try {
      expect(existsSync(dir)).toBe(true);
      expect(dirname(dir)).toBe(tmpdir());
    } finally {
      cleanup();
    }
  });

  it('applies the provided prefix to the directory name', () => {
    const { dir, cleanup } = createTempDir('nx-test-');
    try {
      expect(basename(dir).startsWith('nx-test-')).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('returns distinct directories on repeated calls', () => {
    const a = createTempDir();
    const b = createTempDir();
    try {
      expect(a.dir).not.toBe(b.dir);
    } finally {
      a.cleanup();
      b.cleanup();
    }
  });

  it('removes the directory on cleanup and is idempotent', () => {
    const { dir, cleanup } = createTempDir();
    expect(existsSync(dir)).toBe(true);
    cleanup();
    expect(existsSync(dir)).toBe(false);
    // A second call must not throw even though the directory is gone.
    expect(() => cleanup()).not.toThrow();
  });
});
