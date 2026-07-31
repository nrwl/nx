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
} from './tmp-dir';
import {
  ensureOwnedPrivateDir,
  ensureSafeSharedRoot,
  sharedRootRemedy,
} from '../utils/owned-private-dir';
import { logger } from '../utils/logger';

jest.mock('../utils/owned-private-dir', () => ({
  ensureOwnedPrivateDir: jest.fn(() => true),
  ensureSafeSharedRoot: jest.fn(() => true),
  sharedRootRemedy: jest.fn(() => undefined),
  getUserSegment: jest.fn(() => '501'),
}));

jest.mock('../utils/logger', () => ({
  logger: {
    verbose: jest.fn(),
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

    expect(ensureSafeSharedRoot).toHaveBeenCalledWith(SHARED_TMP_ROOT);
    expect(ensureOwnedPrivateDir).toHaveBeenNthCalledWith(1, USER_TMP_ROOT);
    expect(ensureOwnedPrivateDir).toHaveBeenNthCalledWith(2, SOCKET_ROOT);
    expect(ensureOwnedPrivateDir).toHaveBeenNthCalledWith(3, dir);
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
    expect(ensureOwnedPrivateDir).not.toHaveBeenCalledWith(USER_TMP_ROOT);
    expect(ensureOwnedPrivateDir).not.toHaveBeenCalledWith(SOCKET_ROOT);
  });

  it('moves to the home root when the per-user root is not ours', () => {
    setPlatform('linux');
    (ensureOwnedPrivateDir as jest.Mock).mockImplementation(
      (d: string) => d !== USER_TMP_ROOT
    );

    expect(getSocketDir()).toMatch(
      new RegExp(`^${escapeRegExp(HOME_SOCKET_ROOT)}/`)
    );
    expect(ensureOwnedPrivateDir).not.toHaveBeenCalledWith(SOCKET_ROOT);
  });

  it('reaches the workspace only once every default root is unusable', () => {
    setPlatform('linux');
    denyEveryDefaultRoot();

    expect(getSocketDir()).toBe(DAEMON_DIR_FOR_CURRENT_WORKSPACE);
    expect(ensureOwnedPrivateDir).toHaveBeenCalledWith(HOME_TMP_ROOT);
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
      const { NX_TMP_DIR: winTmp } = require('../utils/nx-tmp-dir');
      const winSocketDir = require('./tmp-dir').getSocketDir;

      process.env.NX_SOCKET_DIR = winTmp;
      // %TMP% is per-account and NX_TMP_DIR sits inside it, so telling the user
      // a local attacker could execute code in their daemon would be false.
      let thrown!: Error;
      try {
        winSocketDir();
      } catch (e) {
        thrown = e as Error;
      }
      expect(thrown).toBeInstanceOf(Ctor);
      expect(thrown.message).toContain('Nx manages for its own runtime');
      expect(thrown.message).not.toContain('shared with the other users');
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
    expect(ensureOwnedPrivateDir).not.toHaveBeenCalledWith(HOME_TMP_ROOT);
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

    expect(ensureOwnedPrivateDir).not.toHaveBeenCalledWith(USER_TMP_ROOT);
    expect(ensureOwnedPrivateDir).not.toHaveBeenCalledWith(SOCKET_ROOT);
    expect(ensureSafeSharedRoot).not.toHaveBeenCalled();
  });

  it('creates the plugin socket directory owner-only', () => {
    setPlatform('linux');

    const dir = getPluginSocketDir();

    expect(ensureOwnedPrivateDir).toHaveBeenCalledWith(dir);
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

  it.each([
    ['the system temp dir', () => systemTmpDir],
    ['the Nx shared tmp root', () => SHARED_TMP_ROOT],
  ])(
    'blames other users on this machine only for %s, which they can reach',
    (_name: string, dir: () => string) => {
      setPlatform('linux');
      process.env.NX_SOCKET_DIR = dir();

      expect(() => getSocketDir()).toThrow(/shared with the other users/);
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
      // compromise that has not happened.
      expect(() => getSocketDir()).toThrow(/Nx manages for its own runtime/);
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
    expect(ensureOwnedPrivateDir).toHaveBeenCalledWith('/tmp/nx-custom-sock');
  });

  it('does not establish the default roots when an explicit socket dir is configured', () => {
    setPlatform('linux');
    process.env.NX_SOCKET_DIR = '/tmp/nx-custom-sock';

    getSocketDir();

    expect(ensureOwnedPrivateDir).not.toHaveBeenCalledWith(USER_TMP_ROOT);
    expect(ensureOwnedPrivateDir).not.toHaveBeenCalledWith(SOCKET_ROOT);
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
