import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { platform, tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ensureOwnedPrivateDir,
  ensureSafeSharedRoot,
  isSafeSharedRoot,
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

  // Asserted against real mode bits. A root owned by *another* unprivileged user
  // needs a second uid to stage, so that case is covered by stubbing `getuid` to
  // make our own fixture look foreign, and end to end in a container.
  describe('isSafeSharedRoot', () => {
    posixOnly(
      'should refuse a root owned by another unprivileged user, whatever its mode',
      () => {
        // Sticky lets the *directory's* owner rename entries too, so a peer who
        // owns the root can move our verified directory aside at 1777 just as
        // well as at 0777. Verified cross-uid: sticky alone does not stop them.
        const dir = join(base, 'foreign');
        mkdirSync(dir);
        chmodSync(dir, 0o1777);
        const realUid = process.getuid!();
        const getuid = jest
          .spyOn(process, 'getuid')
          .mockReturnValue(realUid + 1);

        try {
          expect(isSafeSharedRoot(dir)).toBe(false);
        } finally {
          getuid.mockRestore();
        }
      }
    );

    posixOnly('should accept a root owned by root, as /tmp itself is', () => {
      // The one foreign owner that is safe, and the shape a shared machine needs:
      // an image or an admin creates the root, so no unprivileged user owns it.
      // The real /tmp is 1777 and root-owned on both macOS and Linux; realpath
      // because it is a symlink on macOS and this check uses lstat. getuid is
      // stubbed to something neither ours nor 0 so the uid-0 branch is what
      // accepts it even when the suite itself runs as root.
      const systemTmp = realpathSync('/tmp');
      expect(lstatSync(systemTmp).uid).toBe(0);
      const getuid = jest.spyOn(process, 'getuid').mockReturnValue(9999);

      try {
        expect(isSafeSharedRoot(systemTmp)).toBe(true);
      } finally {
        getuid.mockRestore();
      }
    });

    posixOnly(
      'should refuse a world-writable root with no sticky bit, which a peer can rename our directory out of',
      () => {
        const dir = join(base, 'wide-open');
        mkdirSync(dir, { mode: 0o777 });
        chmodSync(dir, 0o777); // mkdir's mode is masked by the umask, chmod is not

        expect(isSafeSharedRoot(dir)).toBe(false);
      }
    );

    // 0o022, not 0o002: a peer sharing our group can rename just as well.
    posixOnly.each(['1777', '1733', '0755', '0700'])(
      'should accept a root at mode %s',
      (octalMode: string) => {
        const mode = parseInt(octalMode, 8);
        const dir = join(base, `root-${octalMode}`);
        mkdirSync(dir);
        chmodSync(dir, mode);

        expect(isSafeSharedRoot(dir)).toBe(true);
      }
    );

    posixOnly.each(['0770', '0707', '0722'])(
      'should refuse a root at mode %s, writable beyond its owner without sticky',
      (octalMode: string) => {
        const mode = parseInt(octalMode, 8);
        const dir = join(base, `root-${octalMode}`);
        mkdirSync(dir);
        chmodSync(dir, mode);

        expect(isSafeSharedRoot(dir)).toBe(false);
      }
    );

    posixOnly('should refuse a symlink planted at the root', () => {
      const victim = join(base, 'victim');
      mkdirSync(victim, { mode: 0o1777 });
      chmodSync(victim, 0o1777);
      const planted = join(base, 'planted');
      symlinkSync(victim, planted);

      // lstat, not stat: the target is a perfectly good shared root.
      expect(isSafeSharedRoot(planted)).toBe(false);
    });

    posixOnly('should refuse a regular file planted at the root', () => {
      const file = join(base, 'not-a-dir');
      writeFileSync(file, '');

      expect(isSafeSharedRoot(file)).toBe(false);
    });

    it('should refuse an absent root', () => {
      expect(isSafeSharedRoot(join(base, 'missing'))).toBe(false);
    });
  });

  describe('ensureSafeSharedRoot', () => {
    posixOnly(
      'should create a missing root sticky + world-writable so other users can coexist',
      () => {
        const dir = join(base, 'root');

        expect(ensureSafeSharedRoot(dir)).toBe(true);
        // Explicit chmod, not mkdir's mode, which the umask masks — under
        // `umask 0077` the created root would otherwise be 0700.
        expect(lstatSync(dir).mode & 0o7777).toBe(0o1777);
      }
    );

    posixOnly('should repair an existing root of ours that lost sticky', () => {
      const dir = join(base, 'unsticky');
      mkdirSync(dir);
      chmodSync(dir, 0o777);

      expect(ensureSafeSharedRoot(dir)).toBe(true);
      expect(lstatSync(dir).mode & 0o7777).toBe(0o1777);
    });

    posixOnly('should not follow a symlink planted at a shared root', () => {
      // Without O_NOFOLLOW this turns whatever the link points at
      // world-writable — sticky stops renames, not new files.
      const victim = join(base, 'victim');
      mkdirSync(victim, { mode: 0o700 });
      chmodSync(victim, 0o700);
      const planted = join(base, 'planted-root');
      symlinkSync(victim, planted);

      expect(ensureSafeSharedRoot(planted)).toBe(false);
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

        expect(ensureSafeSharedRoot(file)).toBe(false);
        expect(lstatSync(file).mode & 0o7777).toBe(0o600);
      }
    );

    posixOnly('should refuse a root whose parent does not exist', () => {
      // Created one level at a time on purpose: a recursive mkdir would create
      // the parent unchecked, and a symlink there redirects everything below.
      expect(ensureSafeSharedRoot(join(base, 'missing', 'root'))).toBe(false);
    });

    // POSIX-only despite being about Windows: it stubs process.platform while
    // keeping real mode bits, which a Windows runner would not have.
    posixOnly(
      'does not chmod on Windows, where named pipes rely on their default DACL',
      () => {
        // Against the live helper: the win32 short-circuit is the only thing
        // stopping the chmod, so deleting it turns 0700 into 1777 here.
        const dir = join(base, 'win32-root');
        mkdirSync(dir, { mode: 0o700 });
        chmodSync(dir, 0o700);
        const original = process.platform;
        Object.defineProperty(process, 'platform', { value: 'win32' });

        try {
          expect(ensureSafeSharedRoot(dir)).toBe(true);
        } finally {
          Object.defineProperty(process, 'platform', { value: original });
        }

        expect(lstatSync(dir).mode & 0o7777).toBe(0o700);
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
