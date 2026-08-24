import type { Mock } from 'vitest';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { tmpdir as systemTmpDir } from 'tmp';
import {
  DAEMON_DIR_FOR_CURRENT_WORKSPACE,
  getPluginSocketDir,
  getSocketDir,
  getSocketDirFallbackCause,
  InvalidSocketDirConfigured,
  resetSocketDirWarningsForTesting,
} from './tmp-dir';
import {
  describeRefusal,
  type DirRefusal,
  ensureOwnedPrivateDir,
  ensureSafeSharedRoot,
  isPeerWritable,
  remedyFor,
} from '../utils/owned-private-dir';
import { logger } from '../utils/logger';
import { isSandbox } from '../utils/is-sandbox';

// isPeerWritable delegates to the real implementation rather than returning a
// constant: it is the only one of these whose platform behaviour the refusal
// messages depend on, and stubbing it is how the Windows rows came to assert an
// answer the shipped function could not give. Rows that need a specific answer
// still override it explicitly.
vi.mock('../utils/owned-private-dir', async () => {
  const actual = await vi.importActual('../utils/owned-private-dir');
  // Only the two guards are stubbed. describeRefusal/remedyFor/
  // DirectoryRefusedError stay real, so the messages these tests assert on are
  // the ones users get rather than ones the mock invented.
  return {
    ...actual,
    ensureOwnedPrivateDir: vi.fn((d: string) => ({ status: 'ok', path: d })),
    ensureSafeSharedRoot: vi.fn((d: string) => ({ status: 'ok', path: d })),
    isPeerWritable: vi.fn(actual.isPeerWritable),
    getUserSegment: vi.fn(() => '501'),
  };
});

vi.mock('../utils/is-sandbox', () => ({
  isSandbox: vi.fn(() => false),
}));

// The source lazy-requires the logger (CJS channel), which vi.mock cannot
// intercept. Mutate the CJS instance and return it from the factory so both
// module channels share the same mocked object.
vi.mock('../utils/logger', () => {
  const cjs = require('../utils/logger');
  cjs.logger.verbose = vi.fn();
  cjs.logger.warn = vi.fn();
  return cjs;
});

vi.mock('node:fs', async () => {
  const actual = await vi.importActual('node:fs');
  return {
    ...actual,
    mkdirSync: vi.fn(),
  };
});

const SHARED_TMP_ROOT = '/tmp/.nx';
const USER_TMP_ROOT = `${SHARED_TMP_ROOT}/501`;
const SOCKET_ROOT = `${USER_TMP_ROOT}/sockets`;
const HOME_TMP_ROOT = join(homedir(), '.nx');
const HOME_SOCKET_ROOT = join(HOME_TMP_ROOT, 'sockets');

/** The directories a guard was asked about, which is what these tests are about. */
const dirsPassedTo = (fn: unknown): string[] =>
  (fn as Mock).mock.calls.map((c) => c[0]);

const accept = (dir: string) => ({ status: 'ok', path: dir });
// Typed as DirRefusal, not `object`: these mocks stand in for the real guards,
// so a staged shape the guards cannot produce is the one mistake worth failing
// on. Only catches fresh object literals — excess-property checking does not
// reach a value passed through a variable, so the `const` fixtures below carry
// the annotation themselves. Specs are not typechecked in CI, so this shows up
// in the editor and in an explicit `tsc` run.
const reject = (dir: string, refusal?: DirRefusal) => ({
  status: 'refused',
  refusal: refusal ?? { kind: 'not-a-directory', dir },
});

/**
 * Stage a machine where neither default root can be used, which is the only way
 * to reach the workspace now that the home root sits between them.
 */
const denyEveryDefaultRoot = () => {
  (ensureSafeSharedRoot as Mock).mockImplementation((d: string) => reject(d));
  (ensureOwnedPrivateDir as Mock).mockImplementation((d: string) =>
    !d.startsWith(HOME_TMP_ROOT) ? accept(d) : reject(d)
  );
};

describe('socket directories', () => {
  const originalPlatform = process.platform;

  const setPlatform = (platform: NodeJS.Platform) =>
    Object.defineProperty(process, 'platform', { value: platform });

  afterEach(async () => {
    vi.clearAllMocks();
    // clearAllMocks resets calls but keeps implementations, so a test that
    // stages an unusable root would otherwise stage it for every test after it.
    (ensureSafeSharedRoot as Mock).mockImplementation((d: string) => accept(d));
    (ensureOwnedPrivateDir as Mock).mockImplementation((d: string) =>
      accept(d)
    );
    (isPeerWritable as Mock).mockImplementation(
      (await vi.importActual('../utils/owned-private-dir')).isPeerWritable
    );
    (isSandbox as Mock).mockReturnValue(false);
    // The workspace-fallback warning is latched once per process, so without
    // this only the first test staging that fallback would see it.
    resetSocketDirWarningsForTesting();
    delete process.env.NX_SOCKET_DIR;
    delete process.env.NX_DAEMON_SOCKET_DIR;
    setPlatform(originalPlatform);
  });

  // Asserted through getSocketDir rather than a root accessor: the accessor
  // resolved the root without applying the refusal list, so it could report a
  // location the socket path would never actually use.
  describe('socket root resolution', () => {
    it('defaults beneath the stable sandbox root and per-user boundary on POSIX', () => {
      setPlatform('linux');
      expect(getSocketDir()).toMatch(
        new RegExp(`^${escapeRegExp(SOCKET_ROOT)}/`)
      );
    });

    it('defaults to the bare OS temp dir on Windows', () => {
      setPlatform('win32');
      // Named pipes are not filesystem objects, so there is nothing to allowlist
      // or lock down there, and `%TMP%` is already per-user.
      expect(getSocketDir()).toMatch(
        new RegExp(`^${escapeRegExp(systemTmpDir)}`)
      );
    });

    it('is overridable via NX_SOCKET_DIR', () => {
      process.env.NX_SOCKET_DIR = '/custom/socket/dir';
      // Used as given: a configured value names the socket directory itself.
      expect(getSocketDir()).toEqual('/custom/socket/dir');
    });

    it('falls back to the legacy NX_DAEMON_SOCKET_DIR variable', () => {
      process.env.NX_DAEMON_SOCKET_DIR = '/legacy/socket/dir';
      expect(getSocketDir()).toEqual('/legacy/socket/dir');
    });
  });

  it('places workspace-unique socket dirs under the user socket root', () => {
    setPlatform('linux');

    expect(getSocketDir()).toMatch(
      new RegExp(`^${escapeRegExp(SOCKET_ROOT)}/`)
    );
    expect(getSocketDir()).not.toEqual(SOCKET_ROOT);
  });

  it('places plugin socket dirs under the user socket root too', () => {
    setPlatform('linux');

    expect(getPluginSocketDir()).toMatch(
      new RegExp(`^${escapeRegExp(SOCKET_ROOT)}/`)
    );
  });

  it('establishes the shared container and every owner-only root outermost first', () => {
    setPlatform('linux');

    const dir = getSocketDir();

    expect(dirsPassedTo(ensureSafeSharedRoot)).toContain(SHARED_TMP_ROOT);
    expect(dirsPassedTo(ensureOwnedPrivateDir)[0]).toEqual(USER_TMP_ROOT);
    expect(dirsPassedTo(ensureOwnedPrivateDir)[1]).toEqual(SOCKET_ROOT);
    expect(dirsPassedTo(ensureOwnedPrivateDir)[2]).toEqual(dir);
    expect(mkdirSync).not.toHaveBeenCalledWith(dir, {
      recursive: true,
      mode: 0o700,
    });
  });

  it('moves to the home root, not the workspace, beneath an unsafe shared container', () => {
    setPlatform('linux');
    (ensureSafeSharedRoot as Mock).mockImplementation((d: string) => reject(d));

    // The tier that needs an administrator is the one being skipped, so a peer
    // owning /tmp/.nx no longer costs the short socket path.
    expect(getSocketDir()).toMatch(
      new RegExp(`^${escapeRegExp(HOME_SOCKET_ROOT)}/`)
    );
    expect(dirsPassedTo(ensureOwnedPrivateDir)).not.toContain(USER_TMP_ROOT);
    expect(dirsPassedTo(ensureOwnedPrivateDir)).not.toContain(SOCKET_ROOT);
  });

  it('moves to the home root when the per-user root is not ours', () => {
    setPlatform('linux');
    (ensureOwnedPrivateDir as Mock).mockImplementation((d: string) =>
      d !== USER_TMP_ROOT ? accept(d) : reject(d)
    );

    expect(getSocketDir()).toMatch(
      new RegExp(`^${escapeRegExp(HOME_SOCKET_ROOT)}/`)
    );
    expect(dirsPassedTo(ensureOwnedPrivateDir)).not.toContain(SOCKET_ROOT);
  });

  it('reaches the workspace only once every default root is unusable', () => {
    setPlatform('linux');
    denyEveryDefaultRoot();

    expect(getSocketDir()).toBe(DAEMON_DIR_FOR_CURRENT_WORKSPACE);
    expect(dirsPassedTo(ensureOwnedPrivateDir)).toContain(HOME_TMP_ROOT);
  });

  it('warns rather than only logging verbosely when it reaches the workspace', () => {
    setPlatform('linux');
    denyEveryDefaultRoot();

    expect(getSocketDir()).toBe(DAEMON_DIR_FOR_CURRENT_WORKSPACE);
    // A tier-1 to tier-2 demotion stays silent; reaching the workspace does
    // not, because it is outside the allowlist the docs tell teams to commit,
    // and logger.verbose is a no-op without NX_VERBOSE_LOGGING.
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(DAEMON_DIR_FOR_CURRENT_WORKSPACE)
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('--verbose')
    );
    // Outside a sandbox the warning says nothing about one. This path is
    // reached far more often for ordinary reasons — a peer owning the shared
    // container, a read-only home — and naming a sandbox unprompted is the
    // mistake the socket guidance was corrected for once already.
    expect(logger.warn).not.toHaveBeenCalledWith(
      expect.stringMatching(/sandbox|allowlist/i)
    );
  });

  it('adds the allowlist note only when a sandbox is actually detected', () => {
    setPlatform('linux');
    (isSandbox as Mock).mockReturnValue(true);
    denyEveryDefaultRoot();

    expect(getSocketDir()).toBe(DAEMON_DIR_FOR_CURRENT_WORKSPACE);
    // The workspace is outside the roots a team would have allowlisted, so a
    // sandboxed user needs to know their existing entry no longer covers it.
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/allowlist/i)
    );
  });

  it('warns once per process, not once per socket directory resolved', () => {
    setPlatform('linux');
    denyEveryDefaultRoot();

    // A single command resolves this more than once — the daemon socket, then
    // one per isolated plugin worker and forked task — and neither accessor is
    // memoized, so an unlatched warn repeats the same three sentences at the
    // user several times.
    getSocketDir();
    getPluginSocketDir();
    getSocketDir();

    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('names only the roots that exist when there is no home directory', async () => {
    setPlatform('linux');
    (isSandbox as Mock).mockReturnValue(true);
    vi.resetModules();
    vi.doMock('node:os', async () => ({
      ...require('node:os'),
      // No home directory is one of the reasons the home tier is skipped and
      // this fallback is reached, so the sandbox line has to survive it.
      homedir: () => '',
    }));
    const { getSocketDir: homelessSocketDir } = await import('./tmp-dir');
    const { logger: isolatedLogger } = await import('../utils/logger');
    (
      await import('../utils/owned-private-dir')
    ).ensureSafeSharedRoot.mockImplementation((d: string) => ({
      status: 'refused',
      refusal: { kind: 'not-a-directory', dir: d },
    }));
    (await import('../utils/is-sandbox')).isSandbox.mockReturnValue(true);

    homelessSocketDir();

    // Asserted as the whole clause, positively. The literal text `undefined`
    // was the *old* bug's symptom (template interpolation); dropping
    // .filter(Boolean) now yields a dangling "only /tmp/.nx or does not
    // cover", which no absence-of-'undefined' check can see.
    expect(isolatedLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('covering only /tmp/.nx does not cover')
    );
    vi.doUnmock('node:os');
  });

  // The whole line, not a substring. Each piece is pinned where it is written
  // (describeRefusal and remedyFor in owned-private-dir.spec); what this pins is
  // the assembly — which pieces appear, in what order, and that the optional
  // ones are dropped rather than leaving a gap or a stray separator.
  it('assembles the fallback warning the user actually reads', () => {
    setPlatform('linux');
    const container: DirRefusal = {
      kind: 'foreign-shared-container',
      dir: SHARED_TMP_ROOT,
      uid: 1001,
    };
    (ensureSafeSharedRoot as Mock).mockImplementation((d: string) =>
      reject(d, container)
    );
    (ensureOwnedPrivateDir as Mock).mockImplementation((d: string) =>
      d.startsWith(HOME_TMP_ROOT) ? reject(d) : accept(d)
    );

    expect(getSocketDir()).toBe(DAEMON_DIR_FOR_CURRENT_WORKSPACE);

    expect(logger.warn).toHaveBeenCalledWith(
      [
        `Nx could not use any of its usual socket directories and fell back to ${DAEMON_DIR_FOR_CURRENT_WORKSPACE}.`,
        remedyFor(container),
        'Run with --verbose to see why the others were rejected.',
      ].join(' ')
    );
  });

  // Same path with nothing actionable to say. The remedy is dropped entirely
  // rather than rendering an empty segment or a doubled space.
  it('leaves no gap in the warning when there is no remedy to offer', () => {
    setPlatform('linux');
    denyEveryDefaultRoot();

    getSocketDir();

    expect(logger.warn).toHaveBeenCalledWith(
      `Nx could not use any of its usual socket directories and fell back to ${DAEMON_DIR_FOR_CURRENT_WORKSPACE}. Run with --verbose to see why the others were rejected.`
    );
  });

  // What `--verbose` adds, which is the thing the warning above promises.
  it('explains each rejected root at verbose level', () => {
    setPlatform('linux');
    const shared: DirRefusal = {
      kind: 'foreign-shared-container',
      dir: SHARED_TMP_ROOT,
      uid: 1001,
    };
    const home: DirRefusal = {
      kind: 'not-tightenable',
      dir: HOME_TMP_ROOT,
      mode: 0o40755,
    };
    (ensureSafeSharedRoot as Mock).mockImplementation(() => reject('', shared));
    (ensureOwnedPrivateDir as Mock).mockImplementation((d: string) =>
      d.startsWith(HOME_TMP_ROOT) ? reject('', home) : accept(d)
    );

    getSocketDir();

    expect((getSocketDirFallbackCause() as Error).message).toEqual(
      `Nx could not establish any of its default socket directories: ${describeRefusal(
        shared
      )}; ${describeRefusal(home)}.`
    );
  });

  // The third exit: a tier establishes, then the per-run leaf beneath it fails.
  // That path used to build its own one-element list from the leaf error and
  // discard the caller's, so the reason the *tier above* was skipped — and with
  // it the only actionable remedy in the scenario — never reached the user,
  // while the warning still told them --verbose would explain it.
  it('keeps the skipped tiers in the report when the leaf beneath a tier fails', () => {
    setPlatform('linux');
    (ensureSafeSharedRoot as Mock).mockImplementation((d: string) =>
      reject(d, { kind: 'foreign-shared-container', dir: d, uid: 1001 })
    );
    // The home tier establishes; its per-run leaf does not.
    (ensureOwnedPrivateDir as Mock).mockImplementation((d: string) =>
      d.startsWith(HOME_SOCKET_ROOT + '/') ? reject(d) : accept(d)
    );

    expect(getSocketDir()).toBe(DAEMON_DIR_FOR_CURRENT_WORKSPACE);

    const cause = getSocketDirFallbackCause() as AggregateError;
    expect(cause.errors.map((e: any) => e.refusal.kind)).toContain(
      'foreign-shared-container'
    );
    // And the remedy that only the skipped tier's refusal can supply.
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('sudo chown root')
    );
  });

  it('reports the leaf remedy as well as the skipped tier it sits under', () => {
    setPlatform('linux');
    (ensureSafeSharedRoot as Mock).mockImplementation((d: string) =>
      reject(d, { kind: 'foreign-shared-container', dir: d, uid: 1001 })
    );
    // The home tier establishes; its per-run leaf is a planted symlink.
    (ensureOwnedPrivateDir as Mock).mockImplementation((d: string) =>
      d.startsWith(HOME_SOCKET_ROOT + '/')
        ? reject(d, { kind: 'not-a-directory', dir: d, symlink: true })
        : accept(d)
    );

    expect(getSocketDir()).toBe(DAEMON_DIR_FOR_CURRENT_WORKSPACE);

    const [warning] = (logger.warn as Mock).mock.calls[0];
    expect(warning).toContain('sudo chown root');
    expect(warning).toContain('treat it as hostile');
  });

  it('does not warn when a later tier succeeds', () => {
    setPlatform('linux');
    (ensureOwnedPrivateDir as Mock).mockImplementation((d: string) =>
      !d.startsWith(USER_TMP_ROOT) ? accept(d) : reject(d)
    );

    getSocketDir();

    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('logs the default-root failure at verbose level and retains it as the fallback cause', () => {
    setPlatform('linux');
    denyEveryDefaultRoot();

    expect(getSocketDir()).toBe(DAEMON_DIR_FOR_CURRENT_WORKSPACE);

    const cause = getSocketDirFallbackCause();
    expect(cause).toBeInstanceOf(Error);
    expect(logger.verbose).toHaveBeenCalledWith(
      expect.stringContaining('could not use the default socket'),
      cause
    );
  });

  // The one refusal path with nowhere left to fall, and the only one that never
  // reaches the warning where every other remedy is printed.
  it('carries the remedy in the last-resort throw, which no warning can reach', () => {
    setPlatform('linux');
    (ensureSafeSharedRoot as Mock).mockImplementation((d: string) =>
      reject(d, { kind: 'foreign-shared-container', dir: d, uid: 1001 })
    );
    (ensureOwnedPrivateDir as Mock).mockImplementation((d: string) =>
      reject(d, { kind: 'not-tightenable', dir: d, mode: 0o40777 })
    );

    expect(() => getSocketDir()).toThrow(/chmod 0700/);
  });

  it('carries the chown remedy in the fallback warning when the container is another user’s', () => {
    setPlatform('linux');
    // Derived from the refusal the guard produced, not from a second lstat.
    // The shared container has its own kind, and that kind is what selects the
    // chown remedy — a per-user directory's `foreign-owner` must not.
    (ensureSafeSharedRoot as Mock).mockImplementation((d: string) =>
      reject(d, { kind: 'foreign-shared-container', dir: d, uid: 1001 })
    );
    (ensureOwnedPrivateDir as Mock).mockImplementation((d: string) =>
      d.startsWith(HOME_TMP_ROOT) ? reject(d) : accept(d)
    );

    expect(getSocketDir()).toBe(DAEMON_DIR_FOR_CURRENT_WORKSPACE);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(`sudo chown root '${SHARED_TMP_ROOT}'`)
    );
  });

  it('keeps the remedy out of the fallback cause, which carries reasons only', () => {
    setPlatform('linux');
    // Staged with the *chownable* refusal on purpose. With a reason the user
    // cannot act on, no arm of describeRefusal emits `chown` and the negative
    // assertion holds for every kind — it could not fail. The remedy belongs to
    // the warning; the cause is what --verbose prints.
    (ensureSafeSharedRoot as Mock).mockImplementation((d: string) =>
      reject(d, { kind: 'foreign-shared-container', dir: d, uid: 1001 })
    );
    (ensureOwnedPrivateDir as Mock).mockImplementation((d: string) =>
      d.startsWith(HOME_TMP_ROOT) ? reject(d) : accept(d)
    );

    expect(getSocketDir()).toBe(DAEMON_DIR_FOR_CURRENT_WORKSPACE);
    const message = (getSocketDirFallbackCause() as Error).message;
    expect(message).toContain('could not establish any of its default socket');
    expect(message).toContain('belongs to another user (uid 1001)');
    expect(message).not.toContain('chown');
    // The advice the user can act on is in the warning instead.
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('sudo chown root')
    );
  });

  it('records the demotion when a later tier wins, so a length failure can explain itself', () => {
    setPlatform('linux');
    // Tier 1 unusable, home tier fine: a successful demotion, which used to be
    // silent. assertValidSocketPath keys its "Nx fell back to … run with
    // --verbose" block off this cause, and without it a socket-length failure
    // here tells the user to set a shorter NX_SOCKET_DIR — advice they may have
    // already followed.
    (ensureOwnedPrivateDir as Mock).mockImplementation((d: string) =>
      !d.startsWith(USER_TMP_ROOT) ? accept(d) : reject(d)
    );

    expect(getSocketDir()).toMatch(
      new RegExp(`^${escapeRegExp(HOME_SOCKET_ROOT)}/`)
    );
    const cause = getSocketDirFallbackCause();
    expect(cause).toBeInstanceOf(Error);
    expect((cause as Error).message).toContain(SOCKET_ROOT);
    // The --verbose the message promises has to print something.
    expect(logger.verbose).toHaveBeenCalledWith(
      expect.stringContaining(SOCKET_ROOT)
    );
    // And it has to name what was refused, not just the tier root below it:
    // `USER_TMP_ROOT` is the directory a user would have to act on, and the
    // tier root is unreadable to them when it is the foreign-owned one.
    expect(logger.verbose).toHaveBeenCalledWith(
      expect.stringContaining(`${USER_TMP_ROOT} exists and is not a directory`)
    );
  });

  // The warning tells the user to rerun with --verbose to see why the roots
  // were rejected, and the guards are the only thing that knows. While they
  // answered with a bare null, --verbose could only repeat the root names, so
  // the message directed people at a command that could not help them.
  it('records why each default root was rejected, which is what --verbose promises', () => {
    setPlatform('linux');
    (ensureSafeSharedRoot as Mock).mockImplementation((d: string) =>
      reject(d, { kind: 'foreign-shared-container', dir: d, uid: 1001 })
    );
    (ensureOwnedPrivateDir as Mock).mockImplementation((d: string) =>
      d.startsWith(HOME_TMP_ROOT)
        ? reject(d, { kind: 'not-tightenable', dir: d, mode: 0o40755 })
        : accept(d)
    );

    expect(getSocketDir()).toBe(DAEMON_DIR_FOR_CURRENT_WORKSPACE);

    // Asserted on the structure, so a reword cannot silently swap the claim.
    const cause = getSocketDirFallbackCause() as AggregateError;
    expect(cause.errors.map((e: any) => e.refusal.kind)).toEqual([
      'foreign-shared-container',
      'not-tightenable',
    ]);
    expect(cause.message).toContain(
      'belongs to another user (uid 1001) rather than to you or to root'
    );
    expect(cause.message).toContain('could not be tightened to 0700');
  });

  // The generic message this replaces named ownership whatever the cause, so a
  // mode problem, a planted symlink and a non-directory all read as "owned by
  // someone else" — wrong in most of the cases it covered.
  it("reports the guard's own reason for a refused NX_SOCKET_DIR", () => {
    setPlatform('linux');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    (ensureOwnedPrivateDir as Mock).mockImplementation((d: string) =>
      d === '/custom/socket/dir'
        ? reject(d, { kind: 'not-a-directory', dir: d })
        : accept(d)
    );
    process.env.NX_SOCKET_DIR = '/custom/socket/dir';

    try {
      expect(getSocketDir()).toBe(DAEMON_DIR_FOR_CURRENT_WORKSPACE);
      expect(String(warn.mock.calls[0]?.[0])).toContain('is not a directory');
    } finally {
      warn.mockRestore();
    }
  });

  it('leaves the fallback cause unset when the first tier wins', () => {
    setPlatform('linux');

    expect(getSocketDir()).toMatch(
      new RegExp(`^${escapeRegExp(SOCKET_ROOT)}/`)
    );
    expect(getSocketDirFallbackCause()).toBeUndefined();
  });

  // NX_HOME_TMP_DIR is a module-scope constant, so the module has to be
  // re-imported with a different home.
  it('skips the home tier when HOME makes it the shared container itself', async () => {
    setPlatform('linux');
    vi.resetModules();
    vi.doMock('node:os', async () => ({
      ...require('node:os'),
      // HOME=/tmp, so ~/.nx IS /tmp/.nx.
      homedir: () => '/tmp',
    }));
    const {
      getSocketDir: collidingSocketDir,
      DAEMON_DIR_FOR_CURRENT_WORKSPACE: workspaceDir,
    } = await import('./tmp-dir');
    const { ensureOwnedPrivateDir: guard } = await import(
      '../utils/owned-private-dir'
    );
    (guard as Mock).mockImplementation((d: string) =>
      d.startsWith(SHARED_TMP_ROOT)
        ? { status: 'refused', refusal: { kind: 'not-a-directory', dir: d } }
        : { status: 'ok', path: d }
    );

    // Falls through to the workspace rather than offering /tmp/.nx as its own
    // second tier — which would send the guard at the shared container and
    // take a root-owned 1777 directory to 0700.
    expect(collidingSocketDir()).toBe(workspaceDir);
    expect(guard).not.toHaveBeenCalledWith(SHARED_TMP_ROOT);
    vi.doUnmock('node:os');
  });

  it('rejects the home roots as a configured socket dir, as it does the shared ones', () => {
    for (const dir of [HOME_TMP_ROOT, HOME_SOCKET_ROOT]) {
      process.env.NX_SOCKET_DIR = dir;
      expect(() => getSocketDir()).toThrow(InvalidSocketDirConfigured);
    }
  });

  // NX_TMP_DIR is a module-scope constant, so flipping process.platform at
  // runtime cannot reach it — the module has to be re-imported as win32.
  it('does not call the Windows per-user temp roots shared with other users', async () => {
    setPlatform('win32');
    vi.resetModules();
    vi.doMock('node:os', async () => ({
      ...require('node:os'),
      platform: () => 'win32',
    }));
    const { InvalidSocketDirConfigured: Ctor } = await import('./tmp-dir');
    const { NX_TMP_DIR: winNxTmp } = await import('../utils/nx-tmp-dir');
    const { tmpdir: winOsTmp } = await import('tmp');
    const winSocketDir = (await import('./tmp-dir')).getSocketDir;
    // isPeerWritable is deliberately left running its real implementation
    // here. Stubbing it to false is what previously made this pass: libuv
    // synthesizes st_mode on Windows from the READONLY attribute and copies
    // the owner bits across, so every directory reports 0777 and a mode test
    // would call both of these roots shared. The win32 guard inside the
    // function is the thing under test.

    const refusalFor = (dir: string) => {
      process.env.NX_SOCKET_DIR = dir;
      try {
        winSocketDir();
      } catch (e) {
        return e as Error;
      }
      throw new Error(`expected ${dir} to be refused`);
    };

    // Both are per-account on Windows, so telling the user a local attacker
    // could execute code in their daemon would be false for either.
    for (const dir of [winOsTmp, winNxTmp]) {
      const thrown = refusalFor(dir);
      expect(thrown).toBeInstanceOf(Ctor);
      expect(thrown.message).not.toContain('execute code');
      expect(thrown.message).not.toContain('shared with the other users');
    }

    // They are refused for different reasons, and the distinction is the
    // point: %TMP% is the user's own temp directory and Nx does not manage
    // it, while NX_TMP_DIR really is Nx's. Calling %TMP% Nx-managed claims
    // Nx locks down and cleans out everything in it.
    expect((refusalFor(winOsTmp) as any).reason).toEqual('os-temp-root');
    expect((refusalFor(winNxTmp) as any).reason).toEqual('nx-managed');
    vi.doUnmock('node:os');
  });

  it('keeps the home tier off Windows, where named pipes have nothing to contain', () => {
    setPlatform('win32');
    (ensureOwnedPrivateDir as Mock).mockImplementation((d: string) =>
      !d.startsWith(HOME_TMP_ROOT) ? accept(d) : reject(d)
    );

    expect(getSocketDir()).toMatch(
      new RegExp(`^${escapeRegExp(systemTmpDir)}`)
    );
    expect(dirsPassedTo(ensureOwnedPrivateDir)).not.toContain(HOME_TMP_ROOT);
  });

  // assertValidSocketPath (socket-utils.ts) currently applies its 95-character
  // guard on Windows too. Keep the layout flat and pin the short directory names
  // so ordinary account names cannot silently consume that budget again.
  it('pins the flat Windows socket directory budget', () => {
    setPlatform('win32');

    const daemonDir = getSocketDir();
    const pluginDir = getPluginSocketDir();

    for (const dir of [daemonDir, pluginDir]) {
      expect(dirname(dir)).toBe(systemTmpDir);
      expect(dir).not.toContain('.nx');
    }
    expect(basename(daemonDir)).toMatch(/^[0-9a-f]{20}$/);
    expect(basename(pluginDir)).toMatch(/^[0-9a-f]{8}$/);
  });

  it('does not establish POSIX-only roots on Windows', () => {
    setPlatform('win32');

    getSocketDir();
    getPluginSocketDir();

    expect(dirsPassedTo(ensureOwnedPrivateDir)).not.toContain(USER_TMP_ROOT);
    expect(dirsPassedTo(ensureOwnedPrivateDir)).not.toContain(SOCKET_ROOT);
    expect(ensureSafeSharedRoot).not.toHaveBeenCalled();
  });

  it('creates the plugin socket directory owner-only', () => {
    setPlatform('linux');

    const dir = getPluginSocketDir();

    expect(dirsPassedTo(ensureOwnedPrivateDir)).toContain(dir);
  });

  it('gives the daemon and plugin sockets distinct directories', () => {
    setPlatform('linux');

    expect(getSocketDir()).not.toBe(getPluginSocketDir());
  });

  // These are either shared with every user or internal Nx roots rather than
  // socket directories. Loud rejection is safer than silently changing their
  // permissions or mixing sockets with the native binding cache.
  it.each([
    ['the system temp dir', () => systemTmpDir],
    ['the Nx shared tmp root', () => SHARED_TMP_ROOT],
    ['the Nx user tmp root', () => USER_TMP_ROOT],
    ['the Nx socket root', () => SOCKET_ROOT],
    ['the native cache root', () => `${USER_TMP_ROOT}/native-cache`],
    // These cover normalization on the way in rather than the comparison itself,
    // which sees an already-resolved path.
    ['the socket root with a trailing slash', () => `${SOCKET_ROOT}/`],
    [
      'the socket root reached via ..',
      () => `${USER_TMP_ROOT}/native-cache/../sockets`,
    ],
  ])(
    'throws InvalidSocketDirConfigured when the socket dir is %s',
    (_name: string, dir: () => string) => {
      setPlatform('linux');
      process.env.NX_SOCKET_DIR = dir();

      expect(() => getSocketDir()).toThrow(InvalidSocketDirConfigured);
      expect(mkdirSync).not.toHaveBeenCalled();
      expect(ensureOwnedPrivateDir).not.toHaveBeenCalled();
    }
  );

  // resolve() normalizes `..` and trailing slashes but does not dereference
  // symlinks, so an aliased spelling of a refused root used to pass the
  // exact-match list — and on macOS /tmp is itself a symlink to /private/tmp,
  // which makes this the default spelling rather than a contrived one. Past the
  // list, ensureOwnedPrivateDir re-locks the directory to 0700 and
  // removeSocketDir aims a recursive delete at it.
  it('refuses a symlinked spelling of a root it refuses directly', async () => {
    setPlatform('linux');
    const realFs = await vi.importActual('node:fs');
    const dir = realFs.mkdtempSync(join(systemTmpDir, 'nx-alias-'));
    const link = join(dir, 'alias');
    realFs.symlinkSync(systemTmpDir, link);

    try {
      process.env.NX_SOCKET_DIR = link;
      expect(() => getSocketDir()).toThrow(InvalidSocketDirConfigured);
    } finally {
      realFs.rmSync(dir, { recursive: true, force: true });
    }
  });

  // The refused root that does *not* exist yet is the case that matters: every
  // root in the refusal list is absent before Nx's first run, and canonicalizing
  // only whole existing paths degrades the check to the string match it
  // replaced on exactly a fresh machine. Staged through the home root, since
  // that one can be relocated to a directory this test controls.
  it('refuses an aliased spelling of a root that does not exist yet', async () => {
    setPlatform('linux');
    const realFs = await vi.importActual('node:fs');
    const home = realFs.mkdtempSync(join(systemTmpDir, 'nx-fresh-home-'));
    const aliasBase = realFs.mkdtempSync(join(systemTmpDir, 'nx-fresh-alias-'));
    const alias = join(aliasBase, 'link');
    realFs.symlinkSync(home, alias);

    try {
      vi.resetModules();
      vi.doMock('node:os', async () => ({
        ...require('node:os'),
        homedir: () => home,
      }));
      const { getSocketDir: freshSocketDir, InvalidSocketDirConfigured: Ctor } =
        await import('./tmp-dir');

      // `<home>/.nx` has never been created; `<alias>/.nx` is the same
      // directory reached through a symlinked parent.
      expect(realFs.existsSync(join(home, '.nx'))).toBe(false);
      process.env.NX_SOCKET_DIR = join(alias, '.nx');

      expect(() => freshSocketDir()).toThrow(Ctor);
      vi.doUnmock('node:os');
    } finally {
      realFs.rmSync(home, { recursive: true, force: true });
      realFs.rmSync(aliasBase, { recursive: true, force: true });
    }
  });

  it.each([
    ['the system temp dir', () => systemTmpDir],
    ['the Nx shared tmp root', () => SHARED_TMP_ROOT],
  ])(
    'blames other users on this machine for %s when they really can reach it',
    (_name: string, dir: () => string) => {
      setPlatform('linux');
      (isPeerWritable as Mock).mockReturnValue(true);
      process.env.NX_SOCKET_DIR = dir();

      expect(() => getSocketDir()).toThrow(/shared with the other users/);
    }
  );

  // The reason follows the directory, not process.platform. os.tmpdir() is a
  // world-writable /tmp on Linux but a private 0700 /var/folders/... on macOS,
  // so a platform test tells most macOS users that their own private directory
  // lets a local attacker execute code in their daemon — the one claim
  // SocketDirRefusal exists to keep true. Pinned on POSIX specifically, since
  // the previous version of this test passed on a macOS runner while asserting
  // the false claim.
  it.each([
    ['the system temp dir', () => systemTmpDir, 'os-temp-root'],
    ['the Nx shared tmp root', () => SHARED_TMP_ROOT, 'nx-managed'],
  ])(
    'does not blame other users for %s when it is private to this user',
    (_name: string, dir: () => string, expected: string) => {
      setPlatform('linux');
      (isPeerWritable as Mock).mockReturnValue(false);
      process.env.NX_SOCKET_DIR = dir();

      let thrown!: Error;
      try {
        getSocketDir();
      } catch (e) {
        thrown = e as Error;
      }
      expect((thrown as any).reason).toEqual(expected);
      expect(thrown.message).not.toContain('shared with the other users');
      expect(thrown.message).not.toContain('execute code');
      // This reason is selected when the root is private to this account, so
      // it cannot claim the machine's other users keep temp files there.
      expect(thrown.message).not.toContain('on the machine');
      // And on POSIX the default socket root is a literal /tmp/.nx, not
      // os.tmpdir() — the two differ in exactly the case that picks this
      // reason, so Nx's sockets are not beneath this root at all.
      expect(thrown.message).not.toContain('subdirectory of this root');
    }
  );

  it.each([
    ['the Nx user tmp root', () => USER_TMP_ROOT],
    ['the Nx socket root', () => SOCKET_ROOT],
    ['the native cache root', () => `${USER_TMP_ROOT}/native-cache`],
  ])(
    'does not claim a local attacker can reach %s, which is the user’s own 0700 dir',
    (_name: string, dir: () => string) => {
      setPlatform('linux');
      process.env.NX_SOCKET_DIR = dir();

      // Refusing these is right, but they are per-user; telling someone a peer
      // could execute code in their own directory would send them chasing a
      // compromise that has not happened. Asserted on the reason rather than
      // the prose, so rewording the message cannot silently swap the claim.
      let thrown!: Error;
      try {
        getSocketDir();
      } catch (e) {
        thrown = e as Error;
      }
      expect((thrown as any).reason).toEqual('nx-managed');
      expect(thrown.message).not.toContain('execute code');
      expect(() => getSocketDir()).not.toThrow(/shared with the other users/);
    }
  );

  it('still accepts a directory beneath an internal Nx root', () => {
    setPlatform('linux');
    // Only exact matches are rejected; the default socket directories Nx builds
    // itself live beneath these roots.
    process.env.NX_SOCKET_DIR = `${SOCKET_ROOT}/mine`;

    expect(getSocketDir()).toBe(`${SOCKET_ROOT}/mine`);
  });

  // An empty value must mean unset. Left as `??`, the empty string survives and
  // `resolve('')` is the working directory — which removeSocketDir deletes
  // recursively. `NX_SOCKET_DIR=` with no value is ordinary in a .env file.
  it.each(['NX_SOCKET_DIR', 'NX_DAEMON_SOCKET_DIR'])(
    'treats an empty %s as unset rather than the working directory',
    (variable: string) => {
      setPlatform('linux');
      process.env[variable] = '';

      const dir = getSocketDir();

      expect(dir).not.toBe(process.cwd());
      expect(dir.startsWith(SOCKET_ROOT + '/')).toBe(true);
    }
  );

  it('ignores an empty NX_SOCKET_DIR shadowing a valid legacy value', () => {
    setPlatform('linux');
    process.env.NX_SOCKET_DIR = '';
    process.env.NX_DAEMON_SOCKET_DIR = '/tmp/nx-legacy-sock';

    expect(getSocketDir()).toBe('/tmp/nx-legacy-sock');
  });

  it('restricts an explicit NX_SOCKET_DIR override', () => {
    setPlatform('linux');
    process.env.NX_SOCKET_DIR = '/tmp/nx-custom-sock';

    const dir = getSocketDir();

    expect(dir).toBe('/tmp/nx-custom-sock');
    expect(dirsPassedTo(ensureOwnedPrivateDir)).toContain(
      '/tmp/nx-custom-sock'
    );
  });

  it('does not establish the default roots when an explicit socket dir is configured', () => {
    setPlatform('linux');
    process.env.NX_SOCKET_DIR = '/tmp/nx-custom-sock';

    getSocketDir();

    expect(dirsPassedTo(ensureOwnedPrivateDir)).not.toContain(USER_TMP_ROOT);
    expect(dirsPassedTo(ensureOwnedPrivateDir)).not.toContain(SOCKET_ROOT);
    expect(ensureSafeSharedRoot).not.toHaveBeenCalled();
  });

  it('does not label an explicit socket-directory failure as a default-root fallback', () => {
    setPlatform('linux');
    process.env.NX_SOCKET_DIR = '/tmp/nx-custom-sock';
    (ensureOwnedPrivateDir as Mock).mockImplementationOnce((d: string) =>
      reject(d)
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation();
    try {
      expect(getSocketDir()).toBe(DAEMON_DIR_FOR_CURRENT_WORKSPACE);
      expect(getSocketDirFallbackCause()).toBeUndefined();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('configured socket directory')
      );
    } finally {
      warn.mockRestore();
    }
  });
});

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
