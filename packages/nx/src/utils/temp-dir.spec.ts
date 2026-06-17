import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname } from 'node:path';
import { createTempDir } from './temp-dir';

describe('createTempDir', () => {
  it('creates a unique directory under the OS temp dir', () => {
    const dir = createTempDir();
    try {
      expect(existsSync(dir)).toBe(true);
      expect(dirname(dir)).toBe(tmpdir());
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('applies the provided prefix to the directory name', () => {
    const dir = createTempDir('nx-test-');
    try {
      expect(basename(dir).startsWith('nx-test-')).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns distinct directories on repeated calls', () => {
    const a = createTempDir();
    const b = createTempDir();
    try {
      expect(a).not.toBe(b);
    } finally {
      rmSync(a, { recursive: true, force: true });
      rmSync(b, { recursive: true, force: true });
    }
  });
});
