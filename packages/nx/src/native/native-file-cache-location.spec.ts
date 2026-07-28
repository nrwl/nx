import { fchmodSync as mockedFchmodSync } from 'fs';
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { platform, tmpdir } from 'node:os';
import { join } from 'path';
import {
  ensureSecureNativeFileCacheLocation,
  getNativeFileCacheLocation,
} from './native-file-cache-location';
import { ensureOwnedPrivateDir } from '../utils/owned-private-dir';
import { nxVersion } from '../utils/versions';

// Real filesystem behavior is the point of these tests (actual symlinks, actual
// modes), so only fchmodSync is replaced, and only to simulate the one failure
// we cannot produce as the owning user: being unable to re-lock a loose dir.
// The helper tightens through an O_NOFOLLOW descriptor, so fchmodSync rather
// than chmodSync is the call that has to fail.
jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return { ...actual, fchmodSync: jest.fn(actual.fchmodSync) };
});

// The ownership/permission hardening has no analogue on Windows, where the OS
// temp dir is per-user rather than shared.
const posixOnly = platform() === 'win32' ? it.skip : it;

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
          ? join(tmpdir(), '.nx', 'native-cache')
          : '/tmp/.nx/native-cache';

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

  // This is the check that stops another local user from planting a `.node`
  // that we would load and execute, so each rejection branch is exercised
  // directly. The caller only composes these results.
  describe('ensureOwnedPrivateDir', () => {
    let base: string;

    beforeEach(() => {
      base = mkdtempSync(join(tmpdir(), 'nx-native-cache-'));
    });

    afterEach(() => {
      jest.restoreAllMocks();
      rmSync(base, { recursive: true, force: true });
    });

    it('should create a missing directory owner-only', () => {
      const dir = join(base, 'fresh');

      expect(ensureOwnedPrivateDir(dir)).toBe(true);
      expect(lstatSync(dir).isDirectory()).toBe(true);
      if (platform() !== 'win32') {
        expect(lstatSync(dir).mode & 0o777).toEqual(0o700);
      }
    });

    it('should accept an existing directory we own that is already locked down', () => {
      const dir = join(base, 'existing');
      mkdirSync(dir, { mode: 0o700 });

      expect(ensureOwnedPrivateDir(dir)).toBe(true);
    });

    posixOnly(
      'should refuse a symlink planted where the directory belongs',
      () => {
        // The attack: the shared parent is world-writable, so a peer can drop a
        // symlink here that points at a directory they control. lstat (not
        // stat) is what makes this detectable.
        const planted = join(base, 'planted');
        mkdirSync(planted, { mode: 0o700 });
        const dir = join(base, 'link');
        symlinkSync(planted, dir);

        expect(ensureOwnedPrivateDir(dir)).toBe(false);
      }
    );

    posixOnly('should refuse a path that exists but is not a directory', () => {
      const dir = join(base, 'not-a-dir');
      writeFileSync(dir, '');

      expect(ensureOwnedPrivateDir(dir)).toBe(false);
    });

    posixOnly('should refuse a directory owned by another user', () => {
      const dir = join(base, 'foreign');
      mkdirSync(dir, { mode: 0o700 });
      // We cannot chown without root, so move our own uid instead — the
      // comparison under test is `stats.uid !== process.getuid()`.
      jest.spyOn(process, 'getuid').mockReturnValue(process.getuid!() + 1);

      expect(ensureOwnedPrivateDir(dir)).toBe(false);
    });

    posixOnly(
      'should re-lock a group/other-writable directory rather than trusting it',
      () => {
        const dir = join(base, 'loose');
        mkdirSync(dir, { mode: 0o777 });
        chmodSync(dir, 0o777); // mkdir's mode is subject to the umask
        expect(lstatSync(dir).mode & 0o022).not.toEqual(0);

        expect(ensureOwnedPrivateDir(dir)).toBe(true);
        expect(lstatSync(dir).mode & 0o777).toEqual(0o700);
      }
    );

    posixOnly(
      'should refuse a writable directory it cannot re-lock (fail closed)',
      () => {
        const dir = join(base, 'stuck');
        mkdirSync(dir, { mode: 0o777 });
        chmodSync(dir, 0o777);
        (mockedFchmodSync as jest.Mock).mockImplementationOnce(() => {
          const error: NodeJS.ErrnoException = new Error('EPERM');
          error.code = 'EPERM';
          throw error;
        });

        expect(ensureOwnedPrivateDir(dir)).toBe(false);
      }
    );
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

    // The two tests below pin the *wiring*, which the `ensureOwnedPrivateDir`
    // suite above cannot: those cover the guard's own branches, but reverting
    // either call site here to a bare `mkdirSync` leaves them all green. They
    // run against an injected root so they do not depend on /tmp/.nx being
    // writable, which it is not under some sandboxes.
    posixOnly('should refuse a per-uid directory planted as a symlink', () => {
      const base = mkdtempSync(join(tmpdir(), 'nx-native-cache-'));
      try {
        // Injected one level inside the fixture so `dirname(cacheRoot)` stays
        // in it. Passing `base` made dirname() the machine's real os.tmpdir(),
        // which the shared-root relax then chmodded to 1777 — on macOS that is
        // the developer's private 0700 /var/folders directory, permanently.
        const cacheRoot = join(base, 'native-cache');
        mkdirSync(cacheRoot, { recursive: true });
        const victim = join(base, 'victim');
        mkdirSync(victim, { mode: 0o755 });
        chmodSync(victim, 0o755); // mkdir's mode is subject to the umask
        // The per-uid dir is the first hop under the world-writable root.
        symlinkSync(victim, join(cacheRoot, String(process.getuid!())));

        expect(ensureSecureNativeFileCacheLocation(cacheRoot)).toBeNull();
        expect(lstatSync(victim).mode & 0o777).toEqual(0o755);
      } finally {
        rmSync(base, { recursive: true, force: true });
      }
    });

    posixOnly('should refuse a version directory planted as a symlink', () => {
      const base = mkdtempSync(join(tmpdir(), 'nx-native-cache-'));
      try {
        const cacheRoot = join(base, 'native-cache');
        const userDir = join(cacheRoot, String(process.getuid!()));
        mkdirSync(userDir, { recursive: true, mode: 0o700 });
        const victim = join(base, 'victim');
        mkdirSync(victim, { mode: 0o755 });
        chmodSync(victim, 0o755); // mkdir's mode is subject to the umask
        // The version dir is the directory a `.node` is loaded out of, so it
        // must be verified rather than created with `recursive: true`.
        symlinkSync(victim, join(userDir, nxVersion));

        expect(ensureSecureNativeFileCacheLocation(cacheRoot)).toBeNull();
        expect(lstatSync(victim).mode & 0o777).toEqual(0o755);
      } finally {
        rmSync(base, { recursive: true, force: true });
      }
    });

    posixOnly(
      'should either return a locked-down per-uid directory or refuse the cache',
      () => {
        // The contract is binary: a usable location is always owner-only, and
        // anything else yields null so the caller loads the binding in place.
        const location = ensureSecureNativeFileCacheLocation();

        if (location === null) {
          return;
        }
        expect(location).toEqual(getNativeFileCacheLocation());
        const userDir = join(location, '..');
        expect(lstatSync(userDir).isDirectory()).toBe(true);
        expect(lstatSync(userDir).uid).toEqual(process.getuid!());
        expect(lstatSync(userDir).mode & 0o022).toEqual(0);
      }
    );
  });
});
