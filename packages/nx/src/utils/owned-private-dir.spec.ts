import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  fchmodSync,
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
  describeRefusal,
  type DirRefusal,
  isPeerWritable,
  ensureOwnedPrivateDir,
  ensureSafeSharedRoot,
  isSafeSharedRoot,
  remedyFor,
} from './owned-private-dir';
import { getSocketDir } from '../daemon/tmp-dir';

jest.mock('node:fs', () => {
  const actual = jest.requireActual('node:fs');
  return {
    ...actual,
    lstatSync: jest.fn(actual.lstatSync),
    fchmodSync: jest.fn(actual.fchmodSync),
  };
});

// Real filesystem behavior is used throughout except for the foreign-owner
// result that cannot be staged without another uid. What is verified here is
// the property that cannot be mocked convincingly: a planted symlink is refused
// rather than followed, and the socket directory is wired through the guard.
const posixOnly = platform() === 'win32' ? it.skip : it;

// Every sentence a user reads about a refused directory is produced here, so
// this is where the wording is pinned. The guards decide *which* refusal; this
// decides what it says. One row per member of the union — a new member with no
// wording fails to compile against DirRefusal, and a reworded one fails here.
describe('describeRefusal', () => {
  it.each<[string, DirRefusal, string]>([
    [
      'not-created with an errno',
      { kind: 'not-created', dir: '/d', code: 'EACCES' },
      '/d could not be created (EACCES)',
    ],
    [
      'not-created without one',
      { kind: 'not-created', dir: '/d' },
      '/d could not be created',
    ],
    [
      'not-inspectable',
      { kind: 'not-inspectable', dir: '/d', code: 'ELOOP' },
      '/d could not be inspected (ELOOP)',
    ],
    [
      'not-a-directory',
      { kind: 'not-a-directory', dir: '/d' },
      '/d is not a directory',
    ],
    [
      'foreign-owner',
      { kind: 'foreign-owner', dir: '/d', uid: 1001 },
      '/d is owned by uid 1001, not by you',
    ],
    [
      'not-tightenable',
      { kind: 'not-tightenable', dir: '/d', mode: 0o40755 },
      '/d is reachable by other users (mode 0755) and could not be tightened to 0700',
    ],
    [
      'peer-writable-not-sticky',
      { kind: 'peer-writable-not-sticky', dir: '/d', mode: 0o41777 },
      '/d is writable by other users but not sticky (mode 1777), so a peer could replace directories inside it',
    ],
  ])('describes %s', (_label, refusal, expected) => {
    expect(describeRefusal(refusal)).toEqual(expected);
  });

  // The file type bits are noise in a message about permissions: lstat reports
  // a directory as 0o40755, and printing "mode 40755" would send someone
  // looking for a mode that does not exist.
  it('renders only the permission bits, not the file type', () => {
    const text = describeRefusal({
      kind: 'not-tightenable',
      dir: '/d',
      mode: 0o40755,
    });

    expect(text).toContain('0755');
    expect(text).not.toContain('40755');
  });
});

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

      expect(ensureOwnedPrivateDir(squatted).status).toBe('refused');
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

      expect(ensureOwnedPrivateDir(dir).status).toBe('ok');
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
        expect(ensureOwnedPrivateDir(dir).status).toBe('refused');
      } finally {
        getuid.mockRestore();
      }
    }
  );

  // The creation path takes the same verdict as the pre-existing one, so a
  // directory Nx just made is refused when it did not land at 0700 and cannot
  // be tightened — the shape a mount that ignores the mode argument produces
  // (WSL2 drvfs without metadata, CIFS with dir_mode, FAT). Both halves are
  // staged, because no POSIX filesystem will produce them on request.
  //
  // Worth being precise about the limit: this guards the case where the chmod
  // *fails*. A mount that accepts chmod and silently does nothing still returns
  // success, so the directory is still branded. That is unchanged by sharing
  // the verdict, and unreachable from here.
  posixOnly(
    'should refuse a directory it created that did not land at 0700',
    () => {
      const dir = join(base, 'mode-ignored');
      (lstatSync as jest.Mock).mockReturnValueOnce({
        isDirectory: () => true,
        uid: process.getuid!(),
        mode: 0o40777,
      });
      (fchmodSync as jest.Mock).mockImplementationOnce(() => {
        throw Object.assign(new Error('denied'), { code: 'EPERM' });
      });

      expect(ensureOwnedPrivateDir(dir).status).toBe('refused');
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
        expect(isSafeSharedRoot('/tmp/.nx').status).toBe('refused');
      }
    );

    posixOnly(
      'should tell the user to chown a container owned by another unprivileged user to root',
      () => {
        const currentUid = process.getuid!();
        (lstatSync as jest.Mock).mockReturnValueOnce({
          isDirectory: () => true,
          uid: currentUid === 1 ? 2 : 1,
          mode: 0o41777,
        });

        // Refusing is not actionable on its own: only root can take the
        // container over, and until someone does every other user falls back.
        const verdict = isSafeSharedRoot('/tmp/.nx');
        expect(verdict.status).toBe('refused');
        expect(remedyFor((verdict as any).refusal)).toContain(
          'sudo chown root /tmp/.nx'
        );
      }
    );

    posixOnly.each([
      ['root-owned', 0],
      ['ours', 501],
    ])(
      'should offer no remedy for a container that is %s',
      (_label: string, uid: number) => {
        const getuid = jest.spyOn(process, 'getuid').mockReturnValue(501);
        (lstatSync as jest.Mock).mockReturnValueOnce({
          isDirectory: () => true,
          uid,
          mode: 0o41777,
        });
        try {
          const verdict = isSafeSharedRoot('/tmp/.nx');
          expect(
            verdict.status === 'refused'
              ? remedyFor(verdict.refusal)
              : undefined
          ).toBeUndefined();
        } finally {
          getuid.mockRestore();
        }
      }
    );

    posixOnly('should offer no remedy for a container that is absent', () => {
      const verdict = isSafeSharedRoot(join(base, 'missing'));
      expect(verdict.status).toBe('refused');
      expect(remedyFor((verdict as any).refusal)).toBeUndefined();
    });

    posixOnly('should accept a root-owned sticky container', () => {
      const getuid = jest.spyOn(process, 'getuid').mockReturnValue(501);
      (lstatSync as jest.Mock).mockReturnValueOnce({
        isDirectory: () => true,
        uid: 0,
        mode: 0o41777,
      });
      try {
        expect(isSafeSharedRoot('/tmp/.nx').status).toBe('ok');
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

        expect(isSafeSharedRoot(dir).status).toBe('refused');
      }
    );

    posixOnly('should refuse a symlink planted at the shared root', () => {
      const victim = join(base, 'victim-root');
      mkdirSync(victim);
      chmodSync(victim, 0o1777);
      const planted = join(base, 'planted-root');
      symlinkSync(victim, planted);

      expect(isSafeSharedRoot(planted).status).toBe('refused');
    });

    posixOnly(
      'should create the one shared container sticky and world-writable',
      () => {
        const dir = join(base, 'shared');
        // Explicit, because the whole point is the chmod: mkdir's mode is
        // masked, so under `umask 0000` the directory arrives at 1777 on its
        // own and deleting the chmod leaves this green.
        const previousUmask = process.umask(0o022);

        try {
          expect(ensureSafeSharedRoot(dir).status).toBe('ok');
          expect(lstatSync(dir).mode & 0o7777).toBe(0o1777);
        } finally {
          process.umask(previousUmask);
        }
      }
    );

    // The creation branch takes the same verdict as the pre-existing one. It is
    // not redundant with "mkdirSync succeeded": XNU strips S_ISVTX at mkdir, so
    // on macOS the sticky bit exists only because of the chmod, and a chmod that
    // fails under `umask 0000` leaves a world-writable non-sticky container —
    // which a peer can rename aside, above the directory a .node is loaded from.
    // Linux keeps the sticky bit through mkdir, so there the result stays safe
    // and the assertion is on the invariant rather than on a fixed outcome.
    posixOnly(
      'should refuse a container it created if the mode did not land',
      () => {
        const dir = join(base, 'chmod-refused');
        const previousUmask = process.umask(0o000);
        // The mock reproduces the macOS post-condition rather than hoping the
        // runner supplies it. Linux keeps S_ISVTX through mkdir, so a
        // mode-derived expectation is satisfied there whether or not the
        // verdict runs — and Linux is what CI runs, so the guard on this
        // round's headline fix would not have executed anywhere.
        (fchmodSync as jest.Mock).mockImplementationOnce((fd: number) => {
          jest.requireActual('node:fs').fchmodSync(fd, 0o777);
          throw Object.assign(new Error('denied'), { code: 'EPERM' });
        });

        try {
          expect(ensureSafeSharedRoot(dir).status).toBe('refused');
          expect(lstatSync(dir).mode & 0o7777).toBe(0o777);
        } finally {
          process.umask(previousUmask);
        }
      }
    );

    // An existing container is judged, never modified. Applying the mode first
    // and deciding trust after means a process with CAP_FOWNER — root's default
    // in Docker and most CI images — widens a peer's directory before refusing
    // it, and an operator who deliberately tightened this root has it undone by
    // essentially every nx process, since the native binding loader reaches
    // here too.
    posixOnly.each([0o700, 0o755, 0o1700, 0o750])(
      'should judge an existing container at mode %s without modifying it',
      (mode: number) => {
        const dir = join(base, `existing-${mode.toString(8)}`);
        mkdirSync(dir, { mode });
        chmodSync(dir, mode); // mkdir's mode is subject to the umask

        expect(ensureSafeSharedRoot(dir).status).toBe('ok');
        expect(lstatSync(dir).mode & 0o7777).toBe(mode);
      }
    );

    // Parameterized over the runner's own uid, 0 included, because that is the
    // variable the previous version of this test was silently sensitive to. It
    // faked a peer by moving `getuid()`, but a fixture this suite creates is
    // root-owned when the suite runs as root, and `isSafeSharedRoot` exempts
    // uid 0 *before* the mode clause — so no value of `getuid()` could make it
    // look like a peer's. Green on a GitHub runner, red in any container CI.
    // Staging the ownership through the lstat instead makes the runner's uid
    // irrelevant, and running the row at 0 is what keeps that true.
    posixOnly.each([
      ['an unprivileged runner', 501],
      ['a root runner', 0],
    ])(
      'should not modify an existing container it goes on to refuse, under %s',
      (_label: string, runnerUid: number) => {
        const dir = join(base, `peer-owned-${runnerUid}`);
        mkdirSync(dir, { mode: 0o700 });
        chmodSync(dir, 0o700);
        const getuid = jest.spyOn(process, 'getuid').mockReturnValue(runnerUid);
        // Consumed by isSafeSharedRoot; the assertion below gets the real one.
        // uid 1 is neither the runner nor root under either row.
        (lstatSync as jest.Mock).mockReturnValueOnce({
          isDirectory: () => true,
          uid: 1,
          mode: 0o40700,
        });

        try {
          expect(ensureSafeSharedRoot(dir).status).toBe('refused');
        } finally {
          getuid.mockRestore();
        }
        expect(lstatSync(dir).mode & 0o7777).toBe(0o700);
      }
    );

    // A non-directory is never chmod-ed here — `mkdirSync` fails EEXIST and the
    // verdict below refuses it — so what this pins is that the refusal happens
    // before anything touches the planted path, and that the planted path is
    // left exactly as it was found.
    posixOnly.each([
      ['a regular file', (p: string) => writeFileSync(p, '')],
      [
        'a 0600 regular file',
        (p: string) => writeFileSync(p, '', { mode: 0o600 }),
      ],
      ['a FIFO', (p: string) => execFileSync('mkfifo', [p])],
    ])('should not chmod %s planted at the shared root', (_label, plant) => {
      const planted = join(base, 'not-a-dir');
      plant(planted);
      const before = lstatSync(planted).mode & 0o7777;

      expect(ensureSafeSharedRoot(planted).status).toBe('refused');
      expect(lstatSync(planted).mode & 0o7777).toBe(before);
    });

    // 0o022 is group-write plus other-write. Narrowing it to 0o020 accepts a
    // container the whole world can write to, which the sticky clause then
    // waves through.
    posixOnly('should treat other-write alone as peer-writable', () => {
      const dir = join(base, 'other-writable');
      mkdirSync(dir);
      chmodSync(dir, 0o702);

      expect(isSafeSharedRoot(dir).status).toBe('refused');
    });
  });

  posixOnly.each([
    [
      'a 0600 regular file',
      (p: string) => writeFileSync(p, '', { mode: 0o600 }),
    ],
    ['a 0644 regular file', (p: string) => writeFileSync(p, '')],
  ])(
    'should refuse %s rather than branding it a private directory',
    (_l, plant) => {
      // On Windows this check is the only thing between a planted non-directory
      // and an OwnedPrivateDir, since the ownership branch returns early there.
      const planted = join(base, 'not-a-dir');
      plant(planted);

      expect(ensureOwnedPrivateDir(planted).status).toBe('refused');
    }
  );

  describe('isPeerWritable', () => {
    // The alarming refusal message is gated on this, so it has to answer about
    // the directory rather than the platform: os.tmpdir() is a world-writable
    // /tmp on Linux but a private 0700 /var/folders/... on macOS.
    posixOnly.each([
      [0o1777, true],
      [0o777, true],
      [0o770, true],
      [0o702, true],
      [0o700, false],
      [0o755, false],
      [0o750, false],
    ])('should report mode %s as peer-writable=%s', (mode, expected) => {
      const dir = join(base, `mode-${mode.toString(8)}`);
      mkdirSync(dir, { mode });
      chmodSync(dir, mode);

      expect(isPeerWritable(dir)).toBe(expected);
    });

    it('should not claim a path it cannot inspect is peer-writable', () => {
      // This gates the claim that another local user can execute code, so an
      // unreadable path must not be reported as shared.
      expect(isPeerWritable(join(base, 'missing'))).toBe(false);
    });

    posixOnly(
      'should answer for the directory a link points at, not the link',
      () => {
        // Linux creates symlinks 0777, so lstat would report this private
        // target as peer-writable. The inverse holds on macOS, where symlink()
        // takes the umask and a 0755 link hides a world-writable target.
        const target = join(base, 'link-target');
        mkdirSync(target, { mode: 0o700 });
        chmodSync(target, 0o700);
        const link = join(base, 'link-to-target');
        symlinkSync(target, link);

        expect(isPeerWritable(link)).toBe(false);
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
