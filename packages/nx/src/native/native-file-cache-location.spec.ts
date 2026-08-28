import type { Mock } from 'vitest';
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
import { dirname, join } from 'path';
import {
  ensureSecureNativeFileCacheLocation,
  getNativeFileCacheLocationToDelete,
  NATIVE_CACHE_ROOT,
} from './native-file-cache-location';
import { ensureOwnedPrivateDir } from '../utils/owned-private-dir';
import { nxVersion } from '../utils/versions';

// Real filesystem behavior is the point of these tests (actual symlinks, actual
// modes), so only fchmodSync is replaced, and only to simulate the one failure
// we cannot produce as the owning user: being unable to re-lock a loose dir.
// The helper tightens through an O_NOFOLLOW descriptor, so fchmodSync rather
// than chmodSync is the call that has to fail.
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return { ...actual, fchmodSync: vi.fn(actual.fchmodSync) };
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

  // Asserted through NATIVE_CACHE_ROOT rather than a location accessor: the
  // accessor returned a path without establishing or checking it, so it could
  // name a directory the loader would refuse.
  it('should isolate the cache under a per-user root and by Nx version', () => {
    const userSegment =
      typeof process.getuid === 'function' ? String(process.getuid()) : null;

    const root =
      platform() === 'win32'
        ? join(tmpdir(), '.nx', 'native-cache')
        : `/tmp/.nx/${userSegment}/native-cache`;

    expect(NATIVE_CACHE_ROOT).toEqual(root);
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
      vi.restoreAllMocks();
      rmSync(base, { recursive: true, force: true });
    });

    it('should create a missing directory owner-only', () => {
      const dir = join(base, 'fresh');

      expect(ensureOwnedPrivateDir(dir).status).toBe('ok');
      expect(lstatSync(dir).isDirectory()).toBe(true);
      if (platform() !== 'win32') {
        expect(lstatSync(dir).mode & 0o777).toEqual(0o700);
      }
    });

    it('should accept an existing directory we own that is already locked down', () => {
      const dir = join(base, 'existing');
      mkdirSync(dir, { mode: 0o700 });

      expect(ensureOwnedPrivateDir(dir).status).toBe('ok');
    });

    posixOnly(
      'should refuse a symlink planted where the directory belongs',
      () => {
        // A peer can pre-create a predictable path as a symlink that points at
        // a directory they control. lstat (not stat) makes this detectable.
        const planted = join(base, 'planted');
        mkdirSync(planted, { mode: 0o700 });
        const dir = join(base, 'link');
        symlinkSync(planted, dir);

        expect(ensureOwnedPrivateDir(dir).status).toBe('refused');
      }
    );

    posixOnly('should refuse a path that exists but is not a directory', () => {
      const dir = join(base, 'not-a-dir');
      writeFileSync(dir, '');

      expect(ensureOwnedPrivateDir(dir).status).toBe('refused');
    });

    posixOnly('should refuse a directory owned by another user', () => {
      const dir = join(base, 'foreign');
      mkdirSync(dir, { mode: 0o700 });
      // We cannot chown without root, so move our own uid instead — the
      // comparison under test is `stats.uid !== process.getuid()`.
      vi.spyOn(process, 'getuid').mockReturnValue(process.getuid!() + 1);

      expect(ensureOwnedPrivateDir(dir).status).toBe('refused');
    });

    posixOnly(
      'should re-lock a group/other-writable directory rather than trusting it',
      () => {
        const dir = join(base, 'loose');
        mkdirSync(dir, { mode: 0o777 });
        chmodSync(dir, 0o777); // mkdir's mode is subject to the umask
        expect(lstatSync(dir).mode & 0o022).not.toEqual(0);

        expect(ensureOwnedPrivateDir(dir).status).toBe('ok');
        expect(lstatSync(dir).mode & 0o777).toEqual(0o700);
      }
    );

    posixOnly(
      'should refuse a writable directory it cannot re-lock (fail closed)',
      () => {
        const dir = join(base, 'stuck');
        mkdirSync(dir, { mode: 0o777 });
        chmodSync(dir, 0o777);
        (mockedFchmodSync as Mock).mockImplementationOnce(() => {
          const error: NodeJS.ErrnoException = new Error('EPERM');
          error.code = 'EPERM';
          throw error;
        });

        expect(ensureOwnedPrivateDir(dir).status).toBe('refused');
      }
    );
  });

  // The default branch feeds a recursive delete in `nx reset`, and collapsing it
  // to a bare `join(NATIVE_CACHE_ROOT, nxVersion)` — dropping all three guards —
  // otherwise leaves the suite green. Its constants are module scope, so the
  // guards are mocked and the module re-imported rather than staged on disk.
  describe('getNativeFileCacheLocationToDelete', () => {
    const withGuards = async (
      guards: Record<string, unknown>,
      assert: (m: any) => void
    ) => {
      vi.resetModules();
      vi.doMock('../utils/owned-private-dir', async () => ({
        ...(await vi.importActual('../utils/owned-private-dir')),
        isSafeSharedRoot: vi.fn(() => ({
          status: 'ok',
          path: '/tmp/.nx',
        })),
        isOwnedRealDirectory: vi.fn(() => '/tmp/.nx/501'),
        ...guards,
      }));
      assert(await import('./native-file-cache-location'));
      vi.doUnmock('../utils/owned-private-dir');
    };

    it('should return a path when every guard passes', async () => {
      await withGuards({}, (m) => {
        expect(m.getNativeFileCacheLocationToDelete()).not.toBeNull();
      });
    });

    it('should refuse when the shared container is not safe', async () => {
      await withGuards(
        {
          isSafeSharedRoot: vi.fn((d: string) => ({
            status: 'refused',
            refusal: { kind: 'not-a-directory', dir: d },
          })),
        },
        (m) => {
          expect(m.getNativeFileCacheLocationToDelete()).toBeNull();
        }
      );
    });

    // Argument-aware, one directory at a time: a mock that answers the same way
    // for both call sites cannot tell the two guards apart, so dropping either
    // one on its own left the suite green.
    it.each([
      ['the per-user root', () => dirname(NATIVE_CACHE_ROOT)],
      ['the native cache root', () => NATIVE_CACHE_ROOT],
    ])(
      'should refuse when %s is not ours',
      async (_label, refused: () => string) => {
        await withGuards(
          {
            isOwnedRealDirectory: vi.fn((d: string) =>
              d === refused() ? null : d
            ),
          },
          (m) => {
            expect(m.getNativeFileCacheLocationToDelete()).toBeNull();
          }
        );
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

    posixOnly(
      'should refuse an override directory that is not owner-only',
      () => {
        const base = mkdtempSync(join(tmpdir(), 'nx-native-cache-'));
        try {
          // A `.node` is loaded out of here, so being configured does not
          // exempt it: a directory other users can write to is the
          // vulnerability this module exists to close.
          const target = join(base, 'loose');
          mkdirSync(target, { mode: 0o777 });
          chmodSync(target, 0o777);
          const getuid = vi
            .spyOn(process, 'getuid')
            .mockReturnValue(process.getuid!() + 1);
          process.env.NX_NATIVE_FILE_CACHE_DIRECTORY = target;
          try {
            expect(ensureSecureNativeFileCacheLocation()).toBeNull();
          } finally {
            getuid.mockRestore();
          }
        } finally {
          rmSync(base, { recursive: true, force: true });
        }
      }
    );

    posixOnly(
      'should refuse a symlink planted at the override directory even with a trailing slash',
      () => {
        const base = mkdtempSync(join(tmpdir(), 'nx-native-cache-'));
        try {
          // lstat on a path ending in `/` resolves the symlink rather than
          // reporting it, and O_NOFOLLOW then opens the target — so without
          // normalizing the configured value the guards are bypassed.
          const victim = join(base, 'victim');
          mkdirSync(victim, { mode: 0o700 });
          const planted = join(base, 'planted');
          symlinkSync(victim, planted);
          process.env.NX_NATIVE_FILE_CACHE_DIRECTORY = planted + '/';

          expect(ensureSecureNativeFileCacheLocation()).toBeNull();
        } finally {
          rmSync(base, { recursive: true, force: true });
        }
      }
    );

    posixOnly(
      'should refuse a symlink planted at the override directory',
      () => {
        const base = mkdtempSync(join(tmpdir(), 'nx-native-cache-'));
        try {
          const victim = join(base, 'victim');
          mkdirSync(victim, { mode: 0o700 });
          const planted = join(base, 'planted');
          symlinkSync(victim, planted);
          process.env.NX_NATIVE_FILE_CACHE_DIRECTORY = planted;

          expect(ensureSecureNativeFileCacheLocation()).toBeNull();
        } finally {
          rmSync(base, { recursive: true, force: true });
        }
      }
    );

    posixOnly(
      'should not hand an override we do not own to the delete path',
      () => {
        const base = mkdtempSync(join(tmpdir(), 'nx-native-cache-'));
        try {
          const target = join(base, 'foreign');
          mkdirSync(target, { mode: 0o700 });
          const getuid = vi
            .spyOn(process, 'getuid')
            .mockReturnValue(process.getuid!() + 1);
          process.env.NX_NATIVE_FILE_CACHE_DIRECTORY = target;
          try {
            // rmSync(recursive, force) is the sink here.
            expect(getNativeFileCacheLocationToDelete()).toBeNull();
          } finally {
            getuid.mockRestore();
          }
        } finally {
          rmSync(base, { recursive: true, force: true });
        }
      }
    );

    // The tests below pin the *wiring*, which the `ensureOwnedPrivateDir`
    // suite above cannot: those cover the guard's own branches, but reverting
    // either call site here to a bare `mkdirSync` leaves them all green. They
    // run against an injected root so they do not depend on /tmp/.nx/<uid> being
    // writable, which it is not under some sandboxes.
    posixOnly(
      'should refuse the stable shared root planted as a symlink',
      () => {
        const base = mkdtempSync(join(tmpdir(), 'nx-native-cache-'));
        try {
          const victim = join(base, 'victim');
          mkdirSync(victim, { mode: 0o700 });
          chmodSync(victim, 0o700);
          const sharedRoot = join(base, 'shared');
          symlinkSync(victim, sharedRoot);
          const cacheRoot = join(sharedRoot, '501', 'native-cache');

          expect(ensureSecureNativeFileCacheLocation(cacheRoot)).toBeNull();
          expect(lstatSync(victim).mode & 0o7777).toEqual(0o700);
        } finally {
          rmSync(base, { recursive: true, force: true });
        }
      }
    );

    posixOnly(
      'should refuse the per-user temp root planted as a symlink',
      () => {
        const base = mkdtempSync(join(tmpdir(), 'nx-native-cache-'));
        try {
          const nxRoot = join(base, 'nx-user');
          const victim = join(base, 'victim');
          mkdirSync(victim, { mode: 0o755 });
          chmodSync(victim, 0o755); // mkdir's mode is subject to the umask
          symlinkSync(victim, nxRoot);

          expect(
            ensureSecureNativeFileCacheLocation(join(nxRoot, 'native-cache'))
          ).toBeNull();
          expect(lstatSync(victim).mode & 0o777).toEqual(0o755);
        } finally {
          rmSync(base, { recursive: true, force: true });
        }
      }
    );

    posixOnly(
      'should refuse the native cache root planted as a symlink',
      () => {
        const base = mkdtempSync(join(tmpdir(), 'nx-native-cache-'));
        try {
          const nxRoot = join(base, 'nx-user');
          mkdirSync(nxRoot, { mode: 0o700 });
          const victim = join(base, 'victim');
          mkdirSync(victim, { mode: 0o755 });
          chmodSync(victim, 0o755);
          const cacheRoot = join(nxRoot, 'native-cache');
          symlinkSync(victim, cacheRoot);

          expect(ensureSecureNativeFileCacheLocation(cacheRoot)).toBeNull();
          expect(lstatSync(victim).mode & 0o777).toEqual(0o755);
        } finally {
          rmSync(base, { recursive: true, force: true });
        }
      }
    );

    posixOnly('should refuse a version directory planted as a symlink', () => {
      const base = mkdtempSync(join(tmpdir(), 'nx-native-cache-'));
      try {
        const cacheRoot = join(base, 'nx-user', 'native-cache');
        mkdirSync(cacheRoot, { recursive: true, mode: 0o700 });
        const victim = join(base, 'victim');
        mkdirSync(victim, { mode: 0o755 });
        chmodSync(victim, 0o755); // mkdir's mode is subject to the umask
        // The version dir is the directory a `.node` is loaded out of, so it
        // must be verified rather than created with `recursive: true`.
        symlinkSync(victim, join(cacheRoot, nxVersion));

        expect(ensureSecureNativeFileCacheLocation(cacheRoot)).toBeNull();
        expect(lstatSync(victim).mode & 0o777).toEqual(0o755);
      } finally {
        rmSync(base, { recursive: true, force: true });
      }
    });

    posixOnly(
      'should either return a locked-down version directory or refuse the cache',
      () => {
        // The contract is binary: a usable location is always owner-only, and
        // anything else yields null so the caller loads the binding in place.
        const location = ensureSecureNativeFileCacheLocation();

        if (location === null) {
          return;
        }
        expect(location).toEqual(join(NATIVE_CACHE_ROOT, nxVersion));
        expect(getNativeFileCacheLocationToDelete()).toEqual(location);
        const cacheRoot = join(location, '..');
        const userRoot = join(cacheRoot, '..');
        expect(lstatSync(cacheRoot).isDirectory()).toBe(true);
        expect(lstatSync(cacheRoot).uid).toEqual(process.getuid!());
        expect(lstatSync(cacheRoot).mode & 0o077).toEqual(0);
        expect(lstatSync(userRoot).uid).toEqual(process.getuid!());
        expect(lstatSync(userRoot).mode & 0o077).toEqual(0);
      }
    );
  });
});
