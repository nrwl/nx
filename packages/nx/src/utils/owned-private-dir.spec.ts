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
  isSafeSharedRoot,
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
      // The shared socket and cache roots are world-writable by design, so
      // another local user can pre-create our path as a symlink. `mkdirSync`
      // does not throw on one and `chmodSync` follows it, so creating and
      // locking down in one step would both redirect where our files land and
      // silently retarget the chmod at a directory the attacker chose.
      const victim = join(base, 'victim');
      mkdirSync(victim, { mode: 0o755 });
      // mkdir's mode is a request masked by the umask; chmod is not. Without
      // this the fixture is 0700 under a hardened umask and the assertion
      // fails on entirely correct code.
      chmodSync(victim, 0o755);
      const squatted = join(base, 'squatted');
      symlinkSync(victim, squatted);

      expect(ensureOwnedPrivateDir(squatted)).toBe(false);
      expect(lstatSync(victim).mode & 0o777).toBe(0o755);
    }
  );

  posixOnly.each([0o755, 0o750, 0o711, 0o705])(
    'should tighten an existing directory of ours at mode %s to 0700',
    (mode: number) => {
      // Not just the write bits. A plugin worker socket is created with no mode
      // of its own, so the directory is the only thing keeping another local
      // user from reaching it, and search permission is all they need. The
      // workspace-local fallback dir is created by a bare mkdirSync elsewhere
      // in the daemon, so it is routinely 0755 in a real workspace.
      const dir = join(base, `loose-${mode.toString(8)}`);
      mkdirSync(dir, { mode });
      // Required, not belt-and-braces: mkdir masks its mode against the umask,
      // so under `umask 0077` all four fixtures are created 0700 and this table
      // — the only mutation coverage for the 0o077 mask — passes vacuously.
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
      // chmod resolves symlinks, so without O_NOFOLLOW this call turns whatever
      // the link points at world-writable — a local privilege escalation, since
      // the sticky bit stops an attacker deleting existing files but not
      // creating absent ones (an authorized_keys, a PATH shim).
      const victim = join(base, 'victim');
      mkdirSync(victim, { mode: 0o700 });
      symlinkSync(victim, join(base, 'planted-root'));

      relaxSharedRootToSticky(join(base, 'planted-root'));

      expect(lstatSync(victim).mode & 0o777).toBe(0o700);
    });

    posixOnly('should not throw when the root does not exist', () => {
      expect(() =>
        relaxSharedRootToSticky(join(base, 'missing'))
      ).not.toThrow();
    });

    posixOnly(
      'should report a planted symlink as hostile so callers skip nested roots',
      () => {
        // O_NOFOLLOW guards only the final component, so a caller that went on
        // to relax `<root>/sockets` would resolve through the link and grant
        // 0o1777 inside a directory the attacker chose.
        const victim = join(base, 'victim');
        mkdirSync(victim, { mode: 0o700 });
        const planted = join(base, 'planted-root');
        symlinkSync(victim, planted);

        expect(relaxSharedRootToSticky(planted)).toBe(false);
      }
    );

    posixOnly('should report a real directory as safe to nest under', () => {
      const dir = join(base, 'real-root');
      mkdirSync(dir, { mode: 0o700 });

      expect(relaxSharedRootToSticky(dir)).toBe(true);
    });

    // Runs only on POSIX despite being about Windows, and deliberately so: it
    // stubs `process.platform` to exercise the win32 branch while keeping a
    // filesystem whose mode bits are real. On an actual Windows runner Node's
    // chmod only honours the read-only bit, so the assertion below could not
    // hold there even on correct code.
    posixOnly(
      'does not chmod when the platform is Windows (named pipes rely on their default DACL)',
      () => {
        // Asserted against the live helper rather than a mock: tmp-dir.ts calls
        // this on every platform, so the win32 short-circuit is the only thing
        // stopping the chmod, and deleting it turns 0700 into 1777 here.
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

  describe('isSafeSharedRoot', () => {
    posixOnly('should accept a real directory', () => {
      const dir = join(base, 'real');
      mkdirSync(dir);
      expect(isSafeSharedRoot(dir)).toBe(true);
    });

    it('should accept an absent path, which we go on to create ourselves', () => {
      expect(isSafeSharedRoot(join(base, 'missing'))).toBe(true);
    });

    posixOnly('should refuse a symlink planted at the root', () => {
      const victim = join(base, 'victim');
      mkdirSync(victim);
      const planted = join(base, 'planted');
      symlinkSync(victim, planted);

      expect(isSafeSharedRoot(planted)).toBe(false);
    });

    posixOnly('should refuse a regular file planted at the root', () => {
      const file = join(base, 'not-a-dir');
      writeFileSync(file, '');

      expect(isSafeSharedRoot(file)).toBe(false);
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
        process.env.NX_SOCKET_DIR = squatted;

        const dir = getSocketDir();

        expect(dir).not.toEqual(squatted);
        expect(lstatSync(victim).mode & 0o777).toBe(0o755);
      }
    );
  });
});
