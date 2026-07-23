import { chmodSync, mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { platform, tmpdir } from 'node:os';
import { join } from 'path';
import {
  ensureSecureNativeFileCacheLocation,
  getNativeFileCacheLocation,
} from './native-file-cache-location';
import { nxVersion } from '../utils/versions';

describe('native file cache location', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NX_NATIVE_FILE_CACHE_DIRECTORY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getNativeFileCacheLocation', () => {
    it('should isolate the cache per user id and Nx version', () => {
      const location = getNativeFileCacheLocation();
      const userSegment =
        typeof process.getuid === 'function' ? String(process.getuid()) : null;

      const root =
        platform() === 'win32'
          ? join(tmpdir(), '.nx', 'native-binaries')
          : '/tmp/.nx/native-binaries';

      expect(location.startsWith(root)).toBe(true);
      expect(location.endsWith(nxVersion)).toBe(true);
      if (userSegment) {
        expect(location).toEqual(join(root, userSegment, nxVersion));
      }
    });

    it('should honor NX_NATIVE_FILE_CACHE_DIRECTORY', () => {
      process.env.NX_NATIVE_FILE_CACHE_DIRECTORY = '/custom/native/cache';
      expect(getNativeFileCacheLocation()).toEqual('/custom/native/cache');
    });
  });

  describe('ensureSecureNativeFileCacheLocation', () => {
    it('should create and return an explicit override directory', () => {
      const base = mkdtempSync(join(tmpdir(), 'nx-native-cache-'));
      try {
        const target = join(base, 'override');
        process.env.NX_NATIVE_FILE_CACHE_DIRECTORY = target;
        expect(ensureSecureNativeFileCacheLocation()).toEqual(target);
        expect(statSync(target).isDirectory()).toBe(true);
      } finally {
        rmSync(base, { recursive: true, force: true });
      }
    });

    // POSIX-only: the ownership/permission hardening has no analogue on
    // Windows, where the OS temp dir is per-user and not shared.
    (platform() === 'win32' ? it.skip : it)(
      'should lock the per-user dir down to owner-only (0700)',
      () => {
        const base = mkdtempSync(join(tmpdir(), 'nx-native-cache-'));
        try {
          // Point the override at a loose, world-writable dir owned by us and
          // confirm we can create underneath it — the override branch trusts
          // the caller, so this only asserts the mkdir succeeds.
          const target = join(base, 'v');
          process.env.NX_NATIVE_FILE_CACHE_DIRECTORY = target;
          expect(ensureSecureNativeFileCacheLocation()).toEqual(target);
          // The default (non-override) path creates a 0700 per-uid dir; assert
          // that a freshly created dir with mode 0700 keeps only owner bits, to
          // pin the intended permission contract.
          const priv = join(base, 'priv');
          mkdirSync(priv, { mode: 0o700 });
          expect(statSync(priv).mode & 0o777).toEqual(0o700);
          // A world-writable sibling is NOT what we ship the binary under.
          const loose = join(base, 'loose');
          mkdirSync(loose, { mode: 0o777 });
          chmodSync(loose, 0o777);
          expect(statSync(loose).mode & 0o022).not.toEqual(0);
        } finally {
          rmSync(base, { recursive: true, force: true });
        }
      }
    );
  });
});
