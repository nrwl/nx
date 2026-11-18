import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { enableCompileCache } from './compile-cache';
import { NX_USER_TMP_DIR } from './nx-tmp-dir';

const posixIt = process.platform === 'win32' ? it.skip : it;

describe('enableCompileCache', () => {
  const originalEnv = {
    NX_COMPILE_CACHE: process.env.NX_COMPILE_CACHE,
    NODE_COMPILE_CACHE: process.env.NODE_COMPILE_CACHE,
  };
  let root: string;
  let sharedRoot: string;
  let cacheDir: string;

  beforeEach(() => {
    delete process.env.NX_COMPILE_CACHE;
    delete process.env.NODE_COMPILE_CACHE;
    root = mkdtempSync(join(tmpdir(), 'nx-compile-cache-'));
    sharedRoot = join(root, '.nx');
    cacheDir = join(sharedRoot, 'user', 'compile-cache');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('returns false when NX_COMPILE_CACHE=false and does not call enableImpl', () => {
    process.env.NX_COMPILE_CACHE = 'false';
    const enableImpl = vi.fn();
    expect(enableCompileCache(enableImpl, cacheDir)).toBe(false);
    expect(enableImpl).not.toHaveBeenCalled();
  });

  it('returns false when enableImpl is not a function (pre-22.8 Node)', () => {
    expect(enableCompileCache(null, cacheDir)).toBe(false);
  });

  it('enables the cache in an owner-only directory under the Nx tmp root', () => {
    const enableImpl = vi.fn();
    expect(enableCompileCache(enableImpl, cacheDir)).toBe(true);
    expect(enableImpl).toHaveBeenCalledTimes(1);
    expect(enableImpl).toHaveBeenCalledWith(cacheDir);
    const stats = lstatSync(cacheDir);
    expect(stats.isDirectory()).toBe(true);
    if (process.platform !== 'win32') {
      expect(stats.mode & 0o777).toBe(0o700);
    }
  });

  it('passes the Nx user tmp directory by default', () => {
    const enableImpl = vi.fn();
    const enabled = enableCompileCache(enableImpl);
    expect(enableImpl).not.toHaveBeenCalledWith();
    if (enabled) {
      expect(enableImpl).toHaveBeenCalledWith(
        join(NX_USER_TMP_DIR, 'compile-cache')
      );
    }
  });

  it('lets Node pick the location when NODE_COMPILE_CACHE is set', () => {
    process.env.NODE_COMPILE_CACHE = join(root, 'chosen');
    const enableImpl = vi.fn();
    expect(enableCompileCache(enableImpl, cacheDir)).toBe(true);
    expect(enableImpl).toHaveBeenCalledWith();
  });

  posixIt('refuses a cache directory replaced by a symlink', () => {
    const elsewhere = join(root, 'elsewhere');
    mkdirSync(elsewhere);
    mkdirSync(join(sharedRoot, 'user'), { recursive: true, mode: 0o700 });
    symlinkSync(elsewhere, cacheDir);
    const enableImpl = vi.fn();
    expect(enableCompileCache(enableImpl, cacheDir)).toBe(false);
    expect(enableImpl).not.toHaveBeenCalled();
  });

  posixIt('refuses a shared root that other users can rewrite', () => {
    mkdirSync(sharedRoot);
    chmodSync(sharedRoot, 0o777);
    const enableImpl = vi.fn();
    expect(enableCompileCache(enableImpl, cacheDir)).toBe(false);
    expect(enableImpl).not.toHaveBeenCalled();
  });

  it('returns false when enableImpl throws', () => {
    const enableImpl = vi.fn(() => {
      throw new Error('boom');
    });
    expect(enableCompileCache(enableImpl, cacheDir)).toBe(false);
  });
});
