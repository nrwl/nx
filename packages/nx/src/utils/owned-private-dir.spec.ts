import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { platform, tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ensureOwnedPrivateDir,
  isRealDirectoryOrAbsent,
  relaxSharedRootToSticky,
} from './owned-private-dir';
import { getSocketDir } from '../daemon/tmp-dir';

// Real filesystem, no mocks. The branch-level behavior of this helper is
// covered against a mocked `chmodSync` in native-file-cache-location.spec.ts;
// what is verified here is the property that cannot be mocked convincingly —
// that a planted symlink is refused rather than followed — and that the socket
// directory is actually wired through the guard.
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
      // The shared roots are world-writable, so a peer can pre-create our path
      // as a symlink; mkdirSync does not throw on one and chmod follows it.
      const victim = join(base, 'victim');
      mkdirSync(victim, { mode: 0o755 });
      chmodSync(victim, 0o755); // mkdir's mode is masked by the umask, chmod is not
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

  describe('relaxSharedRootToSticky', () => {
    posixOnly(
      'should relax a real directory to sticky + world-writable',
      () => {
        const dir = join(base, 'root');
        mkdirSync(dir, { mode: 0o700 });

        relaxSharedRootToSticky(dir);

        expect(lstatSync(dir).mode & 0o7777).toBe(0o1777);
      }
    );

    posixOnly('should not follow a symlink planted at a shared root', () => {
      // Without O_NOFOLLOW this turns whatever the link points at
      // world-writable — the sticky bit stops deletions, not new files.
      const victim = join(base, 'victim');
      mkdirSync(victim, { mode: 0o700 });
      symlinkSync(victim, join(base, 'planted-root'));

      relaxSharedRootToSticky(join(base, 'planted-root'));

      expect(lstatSync(victim).mode & 0o777).toBe(0o700);
    });

    posixOnly(
      'should not chmod a regular file planted at a shared root',
      () => {
        // The mode is applied to a descriptor only after fstat proves it is a
        // directory, so a planted file is refused rather than chmod-ed to 1777.
        const file = join(base, 'planted-file');
        writeFileSync(file, '');
        chmodSync(file, 0o600);

        relaxSharedRootToSticky(file);

        expect(lstatSync(file).mode & 0o7777).toBe(0o600);
      }
    );

    posixOnly('should not throw when the root does not exist', () => {
      expect(() =>
        relaxSharedRootToSticky(join(base, 'missing'))
      ).not.toThrow();
    });

    // POSIX-only despite being about Windows: it stubs process.platform while
    // keeping real mode bits, which a Windows runner would not have.
    posixOnly(
      'does not chmod when the platform is Windows (named pipes rely on their default DACL)',
      () => {
        // Against the live helper: the win32 short-circuit is the only thing
        // stopping the chmod, so deleting it turns 0700 into 1777 here.
        const dir = join(base, 'win32-root');
        mkdirSync(dir, { mode: 0o700 });
        chmodSync(dir, 0o700);
        const original = process.platform;
        Object.defineProperty(process, 'platform', { value: 'win32' });

        try {
          relaxSharedRootToSticky(dir);
        } finally {
          Object.defineProperty(process, 'platform', { value: original });
        }

        expect(lstatSync(dir).mode & 0o7777).toBe(0o700);
      }
    );
  });

  describe('isRealDirectoryOrAbsent', () => {
    posixOnly('should accept a real directory', () => {
      const dir = join(base, 'real');
      mkdirSync(dir);
      expect(isRealDirectoryOrAbsent(dir)).toBe(true);
    });

    it('should accept an absent path, which we go on to create ourselves', () => {
      expect(isRealDirectoryOrAbsent(join(base, 'missing'))).toBe(true);
    });

    posixOnly('should refuse a symlink planted at the root', () => {
      const victim = join(base, 'victim');
      mkdirSync(victim);
      const planted = join(base, 'planted');
      symlinkSync(victim, planted);

      expect(isRealDirectoryOrAbsent(planted)).toBe(false);
    });

    posixOnly('should refuse a regular file planted at the root', () => {
      const file = join(base, 'not-a-dir');
      writeFileSync(file, '');

      expect(isRealDirectoryOrAbsent(file)).toBe(false);
    });
  });

  describe('socket directory wiring', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    posixOnly(
      'should not hand back a socket dir that was pre-planted as a symlink',
      () => {
        // Without the guard, getSocketDir returns the symlink path itself and
        // chmods the victim directory to 0700 on the way out.
        const victim = join(base, 'victim');
        mkdirSync(victim, { mode: 0o755 });
        chmodSync(victim, 0o755); // mkdir's mode is subject to the umask
        const squatted = join(base, 'squatted');
        symlinkSync(victim, squatted);
        // Trailing slash: without the resolve() in configuredSocketDir it
        // defeats O_NOFOLLOW and the victim gets chmod-ed.
        process.env.NX_SOCKET_DIR = squatted + '/';

        const dir = getSocketDir();

        expect(dir).not.toEqual(squatted);
        expect(lstatSync(victim).mode & 0o777).toBe(0o755);
      }
    );
  });
});
