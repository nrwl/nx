import { mkdirSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { tmpdir as systemTmpDir } from 'tmp';
import {
  DAEMON_DIR_FOR_CURRENT_WORKSPACE,
  getNxSocketRoot,
  getPluginSocketDir,
  getSocketDir,
  getSocketDirFallbackCause,
  InvalidSocketDirConfigured,
} from './tmp-dir';
import {
  ensureOwnedPrivateDir,
  ensureSafeSharedRoot,
} from '../utils/owned-private-dir';
import { logger } from '../utils/logger';

jest.mock('../utils/owned-private-dir', () => ({
  ensureOwnedPrivateDir: jest.fn(() => true),
  ensureSafeSharedRoot: jest.fn(() => true),
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

describe('socket directories', () => {
  const originalPlatform = process.platform;

  const setPlatform = (platform: NodeJS.Platform) =>
    Object.defineProperty(process, 'platform', { value: platform });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.NX_SOCKET_DIR;
    delete process.env.NX_DAEMON_SOCKET_DIR;
    setPlatform(originalPlatform);
  });

  describe('getNxSocketRoot', () => {
    it('defaults beneath the stable sandbox root and per-user boundary on POSIX', () => {
      setPlatform('linux');
      expect(getNxSocketRoot()).toEqual(SOCKET_ROOT);
    });

    it('defaults to the bare OS temp dir on Windows', () => {
      setPlatform('win32');
      // Named pipes are not filesystem objects, so there is nothing to allowlist
      // or lock down there, and `%TMP%` is already per-user.
      expect(getNxSocketRoot()).toEqual(systemTmpDir);
    });

    it('is overridable via NX_SOCKET_DIR', () => {
      process.env.NX_SOCKET_DIR = '/custom/socket/dir';
      expect(getNxSocketRoot()).toEqual('/custom/socket/dir');
    });

    it('falls back to the legacy NX_DAEMON_SOCKET_DIR variable', () => {
      process.env.NX_DAEMON_SOCKET_DIR = '/legacy/socket/dir';
      expect(getNxSocketRoot()).toEqual('/legacy/socket/dir');
    });
  });

  it('places workspace-unique socket dirs under the user socket root', () => {
    setPlatform('linux');

    expect(getSocketDir()).toMatch(
      new RegExp(`^${escapeRegExp(getNxSocketRoot())}`)
    );
    expect(getSocketDir()).not.toEqual(getNxSocketRoot());
  });

  it('places plugin socket dirs under the user socket root too', () => {
    setPlatform('linux');

    expect(getPluginSocketDir()).toMatch(
      new RegExp(`^${escapeRegExp(getNxSocketRoot())}`)
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

  it('falls back before creating user roots beneath an unsafe shared container', () => {
    setPlatform('linux');
    (ensureSafeSharedRoot as jest.Mock).mockReturnValueOnce(false);

    expect(getSocketDir()).toBe(DAEMON_DIR_FOR_CURRENT_WORKSPACE);
    expect(ensureOwnedPrivateDir).not.toHaveBeenCalledWith(USER_TMP_ROOT);
    expect(ensureOwnedPrivateDir).not.toHaveBeenCalledWith(SOCKET_ROOT);
  });

  it('falls back before creating the socket root when the per-user root is not ours', () => {
    setPlatform('linux');
    (ensureOwnedPrivateDir as jest.Mock).mockReturnValueOnce(false);

    expect(getSocketDir()).toBe(DAEMON_DIR_FOR_CURRENT_WORKSPACE);
    expect(ensureOwnedPrivateDir).not.toHaveBeenCalledWith(SOCKET_ROOT);
  });

  it('logs the default-root failure at verbose level and retains it as the fallback cause', () => {
    setPlatform('linux');
    (ensureSafeSharedRoot as jest.Mock).mockReturnValueOnce(false);

    expect(getSocketDir()).toBe(DAEMON_DIR_FOR_CURRENT_WORKSPACE);

    const cause = getSocketDirFallbackCause();
    expect(cause).toBeInstanceOf(Error);
    expect(logger.verbose).toHaveBeenCalledWith(
      expect.stringContaining('could not use the default socket directory'),
      cause
    );
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
      expect(getNxSocketRoot()).toBe(SOCKET_ROOT);
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
