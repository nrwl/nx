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
  ensureOwnedPrivateDir,
  ensureSafeSharedRoot,
  isPeerWritable,
  sharedRootRemedy,
} from '../utils/owned-private-dir';
import { logger } from '../utils/logger';
import { isSandbox } from '../utils/is-sandbox';

// isPeerWritable delegates to the real implementation rather than returning a
// constant: it is the only one of these whose platform behaviour the refusal
// messages depend on, and stubbing it is how the Windows rows came to assert an
// answer the shipped function could not give. Rows that need a specific answer
// still override it explicitly.
jest.mock('../utils/owned-private-dir', () => ({
  ensureOwnedPrivateDir: jest.fn(() => true),
  ensureSafeSharedRoot: jest.fn(() => true),
  sharedRootRemedy: jest.fn(() => undefined),
  isPeerWritable: jest.fn(
    jest.requireActual('../utils/owned-private-dir').isPeerWritable
  ),
  getUserSegment: jest.fn(() => '501'),
}));

jest.mock('../utils/is-sandbox', () => ({
  isSandbox: jest.fn(() => false),
}));

jest.mock('../utils/logger', () => ({
  logger: {
    verbose: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('node:fs', () => {
  const actual = jest.requireActual('node:fs');
  return {
    ...actual,
    mkdirSync: jest.fn(),
  };
});

const SHARED_TMP_ROOT = '/tmp/.nx';
const USER_TMP_ROOT = `${SHARED_TMP_ROOT}/501`;
const SOCKET_ROOT = `${USER_TMP_ROOT}/sockets`;
const HOME_TMP_ROOT = join(homedir(), '.nx');
const HOME_SOCKET_ROOT = join(HOME_TMP_ROOT, 'sockets');

/**
 * Stage a machine where neither default root can be used, which is the only way
 * to reach the workspace now that the home root sits between them.
 */
/**
 * The guards take an optional refusal sink as a second argument, which some
 * call sites pass and others do not. These assert on the directory, which is
 * what every one of these tests is actually about.
 */
const dirsPassedTo = (fn: unknown): string[] =>
  (fn as jest.Mock).mock.calls.map((c) => c[0]);

const denyEveryDefaultRoot = () => {
  (ensureSafeSharedRoot as jest.Mock).mockReturnValue(false);
  (ensureOwnedPrivateDir as jest.Mock).mockImplementation(
    (d: string) => !d.startsWith(HOME_TMP_ROOT)
  );
};

describe('socket directories', () => {
  const originalPlatform = process.platform;

  const setPlatform = (platform: NodeJS.Platform) =>
    Object.defineProperty(process, 'platform', { value: platform });

  afterEach(() => {
    jest.clearAllMocks();
    // clearAllMocks resets calls but keeps implementations, so a test that
    // stages an unusable root would otherwise stage it for every test after it.
    (ensureSafeSharedRoot as jest.Mock).mockReturnValue(true);
    (ensureOwnedPrivateDir as jest.Mock).mockReturnValue(true);
    (sharedRootRemedy as jest.Mock).mockReturnValue(undefined);
    (isPeerWritable as jest.Mock).mockImplementation(
      jest.requireActual('../utils/owned-private-dir').isPeerWritable
    );
    (isSandbox as jest.Mock).mockReturnValue(false);
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
    (ensureSafeSharedRoot as jest.Mock).mockReturnValue(false);

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
    (ensureOwnedPrivateDir as jest.Mock).mockImplementation(
      (d: string) => d !== USER_TMP_ROOT
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
    (isSandbox as jest.Mock).mockReturnValue(true);
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

  it('names only the roots that exist when there is no home directory', () => {
    setPlatform('linux');
    (isSandbox as jest.Mock).mockReturnValue(true);
    jest.isolateModules(() => {
      jest.doMock('node:os', () => ({
        ...jest.requireActual('node:os'),
        // No home directory is one of the reasons the home tier is skipped and
        // this fallback is reached, so the sandbox line has to survive it.
        homedir: () => '',
      }));
      const { getSocketDir: homelessSocketDir } = require('./tmp-dir');
      const { logger: isolatedLogger } = require('../utils/logger');
      require('../utils/owned-private-dir').ensureSafeSharedRoot.mockReturnValue(
        false
      );
      require('../utils/is-sandbox').isSandbox.mockReturnValue(true);

      homelessSocketDir();

      // Asserted as the whole clause, positively. The literal text `undefined`
      // was the *old* bug's symptom (template interpolation); dropping
      // .filter(Boolean) now yields a dangling "only /tmp/.nx or does not
      // cover", which no absence-of-'undefined' check can see.
      expect(isolatedLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('covering only /tmp/.nx does not cover')
      );
    });
    jest.dontMock('node:os');
  });

  it('does not warn when a later tier succeeds', () => {
    setPlatform('linux');
    (ensureOwnedPrivateDir as jest.Mock).mockImplementation(
      (d: string) => !d.startsWith(USER_TMP_ROOT)
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

  it('carries the chown remedy in the fallback cause when the container is another user’s', () => {
    setPlatform('linux');
    denyEveryDefaultRoot();
    (sharedRootRemedy as jest.Mock).mockReturnValue(
      `${SHARED_TMP_ROOT} belongs to another user on this machine, so Nx cannot keep a private directory beneath it. Ask an administrator to hand it to root with \`sudo chown root ${SHARED_TMP_ROOT} && sudo chmod 1777 ${SHARED_TMP_ROOT}\`; every user can then keep their own directory under it.`
    );

    expect(getSocketDir()).toBe(DAEMON_DIR_FOR_CURRENT_WORKSPACE);
    expect(sharedRootRemedy).toHaveBeenCalledWith(SHARED_TMP_ROOT);
    expect((getSocketDirFallbackCause() as Error).message).toContain(
      `sudo chown root ${SHARED_TMP_ROOT}`
    );
  });

  it('omits the remedy when the roots are unusable for a reason the user cannot chown away', () => {
    setPlatform('linux');
    denyEveryDefaultRoot();

    expect(getSocketDir()).toBe(DAEMON_DIR_FOR_CURRENT_WORKSPACE);
    const message = (getSocketDirFallbackCause() as Error).message;
    expect(message).toContain('could not establish any of its default socket');
    expect(message).not.toContain('chown');
  });

  it('records the demotion when a later tier wins, so a length failure can explain itself', () => {
    setPlatform('linux');
    // Tier 1 unusable, home tier fine: a successful demotion, which used to be
    // silent. assertValidSocketPath keys its "Nx fell back to … run with
    // --verbose" block off this cause, and without it a socket-length failure
    // here tells the user to set a shorter NX_SOCKET_DIR — advice they may have
    // already followed.
    (ensureOwnedPrivateDir as jest.Mock).mockImplementation(
      (d: string) => !d.startsWith(USER_TMP_ROOT)
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
  });

  // The warning tells the user to rerun with --verbose to see why the roots
  // were rejected, and the guards are the only thing that knows. While they
  // answered with a bare null, --verbose could only repeat the root names, so
  // the message directed people at a command that could not help them.
  it('records why each default root was rejected, which is what --verbose promises', () => {
    setPlatform('linux');
    (ensureSafeSharedRoot as jest.Mock).mockImplementation((d, why) => {
      why?.(`${d} belongs to another user (uid 1001)`);
      return null;
    });
    (ensureOwnedPrivateDir as jest.Mock).mockImplementation((d, why) => {
      if (d.startsWith(HOME_TMP_ROOT)) {
        why?.(`${d} could not be tightened to 0700`);
        return null;
      }
      return d;
    });

    expect(getSocketDir()).toBe(DAEMON_DIR_FOR_CURRENT_WORKSPACE);

    const cause = getSocketDirFallbackCause() as Error;
    expect(cause.message).toContain('belongs to another user (uid 1001)');
    expect(cause.message).toContain('could not be tightened to 0700');
  });

  // The generic message this replaces named ownership whatever the cause, so a
  // mode problem, a planted symlink and a non-directory all read as "owned by
  // someone else" — wrong in most of the cases it covered.
  it("reports the guard's own reason for a refused NX_SOCKET_DIR", () => {
    setPlatform('linux');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    (ensureOwnedPrivateDir as jest.Mock).mockImplementation((d, why) => {
      if (d === '/custom/socket/dir') {
        why?.(`${d} is not a directory`);
        return null;
      }
      return d;
    });
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
  it('skips the home tier when HOME makes it the shared container itself', () => {
    setPlatform('linux');
    jest.isolateModules(() => {
      jest.doMock('node:os', () => ({
        ...jest.requireActual('node:os'),
        // HOME=/tmp, so ~/.nx IS /tmp/.nx.
        homedir: () => '/tmp',
      }));
      const {
        getSocketDir: collidingSocketDir,
        DAEMON_DIR_FOR_CURRENT_WORKSPACE: workspaceDir,
      } = require('./tmp-dir');
      const {
        ensureOwnedPrivateDir: guard,
      } = require('../utils/owned-private-dir');
      (guard as jest.Mock).mockImplementation(
        (d: string) => !d.startsWith(SHARED_TMP_ROOT)
      );

      // Falls through to the workspace rather than offering /tmp/.nx as its own
      // second tier — which would send the guard at the shared container and
      // take a root-owned 1777 directory to 0700.
      expect(collidingSocketDir()).toBe(workspaceDir);
      expect(guard).not.toHaveBeenCalledWith(SHARED_TMP_ROOT);
    });
    jest.dontMock('node:os');
  });

  it('rejects the home roots as a configured socket dir, as it does the shared ones', () => {
    for (const dir of [HOME_TMP_ROOT, HOME_SOCKET_ROOT]) {
      process.env.NX_SOCKET_DIR = dir;
      expect(() => getSocketDir()).toThrow(InvalidSocketDirConfigured);
    }
  });

  // NX_TMP_DIR is a module-scope constant, so flipping process.platform at
  // runtime cannot reach it — the module has to be re-imported as win32.
  it('does not call the Windows per-user temp roots shared with other users', () => {
    setPlatform('win32');
    jest.isolateModules(() => {
      jest.doMock('node:os', () => ({
        ...jest.requireActual('node:os'),
        platform: () => 'win32',
      }));
      const { InvalidSocketDirConfigured: Ctor } = require('./tmp-dir');
      const { NX_TMP_DIR: winNxTmp } = require('../utils/nx-tmp-dir');
      const { tmpdir: winOsTmp } = require('tmp');
      const winSocketDir = require('./tmp-dir').getSocketDir;
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
    });
    jest.dontMock('node:os');
  });

  it('keeps the home tier off Windows, where named pipes have nothing to contain', () => {
    setPlatform('win32');
    (ensureOwnedPrivateDir as jest.Mock).mockImplementation(
      (d: string) => !d.startsWith(HOME_TMP_ROOT)
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
  it('refuses a symlinked spelling of a root it refuses directly', () => {
    setPlatform('linux');
    const realFs = jest.requireActual('node:fs');
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
  it('refuses an aliased spelling of a root that does not exist yet', () => {
    setPlatform('linux');
    const realFs = jest.requireActual('node:fs');
    const home = realFs.mkdtempSync(join(systemTmpDir, 'nx-fresh-home-'));
    const aliasBase = realFs.mkdtempSync(join(systemTmpDir, 'nx-fresh-alias-'));
    const alias = join(aliasBase, 'link');
    realFs.symlinkSync(home, alias);

    try {
      jest.isolateModules(() => {
        jest.doMock('node:os', () => ({
          ...jest.requireActual('node:os'),
          homedir: () => home,
        }));
        const {
          getSocketDir: freshSocketDir,
          InvalidSocketDirConfigured: Ctor,
        } = require('./tmp-dir');

        // `<home>/.nx` has never been created; `<alias>/.nx` is the same
        // directory reached through a symlinked parent.
        expect(realFs.existsSync(join(home, '.nx'))).toBe(false);
        process.env.NX_SOCKET_DIR = join(alias, '.nx');

        expect(() => freshSocketDir()).toThrow(Ctor);
      });
      jest.dontMock('node:os');
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
      (isPeerWritable as jest.Mock).mockReturnValue(true);
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
      (isPeerWritable as jest.Mock).mockReturnValue(false);
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
    (ensureOwnedPrivateDir as jest.Mock).mockReturnValueOnce(false);
    const warn = jest.spyOn(console, 'warn').mockImplementation();
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
