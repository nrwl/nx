import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { platform, tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ensureOwnedPrivateDir,
  ensureSafeSharedRoot,
  isSafeSharedRoot,
} from './owned-private-dir';
import { getSocketDir } from '../daemon/tmp-dir';

jest.mock('node:fs', () => {
  const actual = jest.requireActual('node:fs');
  return { ...actual, lstatSync: jest.fn(actual.lstatSync) };
});

// Real filesystem behavior is used throughout except for the foreign-owner
// result that cannot be staged without another uid. What is verified here is
// the property that cannot be mocked convincingly: a planted symlink is refused
// rather than followed, and the socket directory is wired through the guard.
const posixOnly = platform() === 'win32' ? it.skip : it;

describe('ensureOwnedPrivateDir', () => {
  let base: string;

  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'nx-owned-private-'));
  });

  afterEach(() => {
    rmSync(base, { recursive: true, force: true });
  });

  posixOnly(
    'should refuse a symlink planted where the directory should be, and leave its target alone',
    () => {
      // A peer can pre-create our predictable top-level path as a symlink before
      // us; mkdirSync does not throw on one and chmod follows it.
      const victim = join(base, 'victim');
      mkdirSync(victim, { mode: 0o755 });
      chmodSync(victim, 0o755);
      const squatted = join(base, 'squatted');
      symlinkSync(victim, squatted);

      expect(ensureOwnedPrivateDir(squatted)).toBe(false);
      expect(lstatSync(victim).mode & 0o777).toBe(0o755);
    }
  );

  // Octal strings so the name reads `mode 0705`; jest renders %s in decimal.
  posixOnly.each(['0755', '0750', '0711', '0705'])(
    'should tighten an existing directory of ours at mode %s to 0700',
    (octalMode: string) => {
      const mode = parseInt(octalMode, 8);
      // Not just the write bits: a plugin worker socket has no mode of its own,
      // so search permission on the directory is all a peer needs.
      const dir = join(base, `loose-${mode.toString(8)}`);
      mkdirSync(dir, { mode });
      // Required: under `umask 0077` all four are created 0700 and this table —
      // the only coverage for the 0o077 mask — passes vacuously without it.
      chmodSync(dir, mode);
      expect(lstatSync(dir).mode & 0o777).toBe(mode);

      expect(ensureOwnedPrivateDir(dir)).toBe(true);
      expect(lstatSync(dir).mode & 0o777).toBe(0o700);
    }
  );

  posixOnly(
    'should refuse a directory owned by another unprivileged user',
    () => {
      const dir = join(base, 'foreign');
      mkdirSync(dir, { mode: 0o700 });
      // We cannot chown without root, so move our own uid instead. Unlike the
      // retired shared-root predicate, uid 0 gets no special exemption here,
      // so this stays meaningful when the suite itself runs as root.
      const getuid = jest
        .spyOn(process, 'getuid')
        .mockReturnValue(process.getuid!() + 1);
      try {
        expect(ensureOwnedPrivateDir(dir)).toBe(false);
      } finally {
        getuid.mockRestore();
      }
    }
  );

  describe('shared container validation', () => {
    posixOnly(
      'should refuse a sticky root owned by another unprivileged user',
      () => {
        const currentUid = process.getuid!();
        const foreignUid = currentUid === 1 ? 2 : 1;
        (lstatSync as jest.Mock).mockReturnValueOnce({
          isDirectory: () => true,
          uid: foreignUid,
          mode: 0o41777,
        });

        // Stub the stat result rather than changing getuid: a real fixture is
        // root-owned when the suite runs as root, and uid 0 is intentionally
        // accepted by the predicate.
        expect(isSafeSharedRoot('/tmp/.nx')).toBe(false);
      }
    );

    posixOnly('should accept a root-owned sticky container', () => {
      const getuid = jest.spyOn(process, 'getuid').mockReturnValue(501);
      (lstatSync as jest.Mock).mockReturnValueOnce({
        isDirectory: () => true,
        uid: 0,
        mode: 0o41777,
      });
      try {
        expect(isSafeSharedRoot('/tmp/.nx')).toBe(true);
      } finally {
        getuid.mockRestore();
      }
    });

    posixOnly(
      'should refuse a peer-writable container without the sticky bit',
      () => {
        const dir = join(base, 'unsticky');
        mkdirSync(dir);
        chmodSync(dir, 0o777);

        expect(isSafeSharedRoot(dir)).toBe(false);
      }
    );

    posixOnly('should refuse a symlink planted at the shared root', () => {
      const victim = join(base, 'victim-root');
      mkdirSync(victim);
      chmodSync(victim, 0o1777);
      const planted = join(base, 'planted-root');
      symlinkSync(victim, planted);

      expect(isSafeSharedRoot(planted)).toBe(false);
    });

    posixOnly(
      'should create the one shared container sticky and world-writable',
      () => {
        const dir = join(base, 'shared');

        expect(ensureSafeSharedRoot(dir)).toBe(true);
        expect(lstatSync(dir).mode & 0o7777).toBe(0o1777);
      }
    );
  });

  describe('socket directory wiring', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
      jest.restoreAllMocks();
    });

    posixOnly(
      'should not hand back a socket dir that was pre-planted as a symlink',
      () => {
        const victim = join(base, 'victim');
        mkdirSync(victim, { mode: 0o755 });
        chmodSync(victim, 0o755);
        const squatted = join(base, 'squatted');
        symlinkSync(victim, squatted);
        // Trailing slash: without resolve() in configuredSocketDir it defeats
        // O_NOFOLLOW and the victim gets chmod-ed.
        process.env.NX_SOCKET_DIR = squatted + '/';

        const dir = getSocketDir();

        expect(dir).not.toEqual(squatted);
        expect(lstatSync(victim).mode & 0o777).toBe(0o755);
      }
    );
  });
});
