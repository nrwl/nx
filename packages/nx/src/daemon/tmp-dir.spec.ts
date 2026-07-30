import { mkdirSync } from 'node:fs';

import { dirname, join } from 'node:path';
import { tmpdir as systemTmpDir } from 'tmp';
import {
  DAEMON_DIR_FOR_CURRENT_WORKSPACE,
  getNxSocketRoot,
  getPluginSocketDir,
  getSocketDir,
  InvalidSocketDirConfigured,
} from './tmp-dir';
import {
  ensureOwnedPrivateDir,
  ensureSafeSharedRoot,
} from '../utils/owned-private-dir';

jest.mock('../utils/owned-private-dir', () => ({
  ensureOwnedPrivateDir: jest.fn(() => true),
  ensureSafeSharedRoot: jest.fn(() => true),
  getUserSegment: jest.fn(() => '501'),
}));

// The per-uid level between the shared root and the socket directories.
const USER_SOCKET_ROOT = '/tmp/.nx/sockets/501';

jest.mock('node:fs', () => {
  const actual = jest.requireActual('node:fs');
  return {
    ...actual,
    mkdirSync: jest.fn(),
  };
});

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
    it('defaults to one stable shared root on POSIX', () => {
      setPlatform('linux');
      expect(getNxSocketRoot()).toEqual('/tmp/.nx/sockets');
    });

    it('defaults to the bare OS temp dir on Windows', () => {
      setPlatform('win32');
      // Named pipes are not filesystem objects, so there is nothing to allowlist
      // or lock down there, and `%TMP%` is already per-user. A `\.nx\sockets`
      // segment would only spend path length — see the budget test below.
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

  it('places workspace-unique socket dirs under the common root', () => {
    setPlatform('linux');

    expect(getSocketDir()).toMatch(
      new RegExp(`^${escapeRegExp(getNxSocketRoot())}`)
    );
    expect(getSocketDir()).not.toEqual(getNxSocketRoot());
  });

  it('places plugin socket dirs under the common root too', () => {
    setPlatform('linux');

    expect(getPluginSocketDir()).toMatch(
      new RegExp(`^${escapeRegExp(getNxSocketRoot())}`)
    );
  });

  it('creates the daemon socket directory owner-only, separately from its parents', () => {
    setPlatform('linux');

    const dir = getSocketDir();

    expect(ensureOwnedPrivateDir).toHaveBeenCalledWith(dir);
    expect(ensureSafeSharedRoot).toHaveBeenCalledWith('/tmp/.nx/sockets');
    expect(mkdirSync).not.toHaveBeenCalledWith(dir, {
      recursive: true,
      mode: 0o700,
    });
  });

  it('puts the socket directories under a per-uid directory it owns', () => {
    setPlatform('linux');

    const dir = getSocketDir();

    // Otherwise whoever ran Nx first owns the parent of everyone else's socket dir.
    expect(dir.startsWith(USER_SOCKET_ROOT + '/')).toBe(true);
    expect(ensureOwnedPrivateDir).toHaveBeenCalledWith(USER_SOCKET_ROOT);
  });

  // assertValidSocketPath (socket-utils.ts) throws above 95 chars and has no
  // platform guard, so it gates Windows too, and `%TMP%` already contains the
  // username. Every segment added here comes straight off the budget for long
  // account names, so the Windows layout stays flat: <TMP>\<hash>\<file>.
  it('adds no directory segments beyond the OS temp dir on Windows', () => {
    setPlatform('win32');

    for (const dir of [getSocketDir(), getPluginSocketDir()]) {
      expect(dirname(dir)).toBe(systemTmpDir);
      expect(dir).not.toContain('.nx');
    }
  });

  it('omits the per-uid segment on Windows', () => {
    setPlatform('win32');
    // The OS temp dir is already per-user there and both lockdown helpers are
    // no-ops, so the segment only spends path length — and the username is
    // already in %TMP%, which overran the 95-char guard for ordinary accounts.
    expect(getSocketDir()).not.toContain(`${USER_SOCKET_ROOT}/`);
    expect(getPluginSocketDir()).not.toContain(`${USER_SOCKET_ROOT}/`);
    expect(ensureOwnedPrivateDir).not.toHaveBeenCalledWith(USER_SOCKET_ROOT);
  });

  it('falls back when the per-uid directory is not ours', () => {
    setPlatform('linux');
    (ensureOwnedPrivateDir as jest.Mock).mockReturnValueOnce(false);

    expect(getSocketDir()).toBe(DAEMON_DIR_FOR_CURRENT_WORKSPACE);
  });

  it('creates the plugin socket directory owner-only, separately from its parents', () => {
    setPlatform('linux');

    const dir = getPluginSocketDir();

    expect(ensureOwnedPrivateDir).toHaveBeenCalledWith(dir);
    expect(ensureSafeSharedRoot).toHaveBeenCalledWith('/tmp/.nx/sockets');
  });

  it('establishes every shared root as sticky + world-writable so other users can coexist', () => {
    setPlatform('linux');

    getSocketDir();

    // Outermost first: the outer root is the parent of the inner one, so a
    // symlink there redirects it before it is ever checked.
    expect(ensureSafeSharedRoot).toHaveBeenNthCalledWith(1, '/tmp/.nx');
    expect(ensureSafeSharedRoot).toHaveBeenNthCalledWith(2, '/tmp/.nx/sockets');
    // ...but never the per-uid directory, which must stay 0700.
    expect(ensureSafeSharedRoot).not.toHaveBeenCalledWith(USER_SOCKET_ROOT);
  });

  it('gives the daemon and plugin sockets distinct directories', () => {
    setPlatform('linux');

    expect(getSocketDir()).not.toBe(getPluginSocketDir());
  });

  // Each is reachable by every user, and Nx locks the socket dir to one of them —
  // so naming a shared root here would strip it of the sticky, world-writable
  // mode the others depend on. Loud, rather than a silently substituted default.
  it.each([
    ['the system temp dir', () => systemTmpDir],
    ['the Nx tmp root', () => '/tmp/.nx'],
    ['the shared socket root', () => '/tmp/.nx/sockets'],
    ['the shared native cache root', () => '/tmp/.nx/native-cache'],
    // Documented as invalid, so it has to be rejected however it is spelled.
    // These cover the normalization on the way in rather than the comparison
    // itself, which sees an already-resolved path.
    ['the shared socket root with a trailing slash', () => '/tmp/.nx/sockets/'],
    [
      'the shared socket root reached via ..',
      () => '/tmp/.nx/native-cache/../sockets',
    ],
  ])(
    'throws InvalidSocketDirConfigured when the socket dir is %s',
    (_name: string, dir: () => string) => {
      setPlatform('linux');
      process.env.NX_SOCKET_DIR = dir();

      expect(() => getSocketDir()).toThrow(InvalidSocketDirConfigured);
      expect(mkdirSync).not.toHaveBeenCalled();
      expect(ensureSafeSharedRoot).not.toHaveBeenCalled();
    }
  );

  it('still accepts a directory that merely sits under a shared root', () => {
    setPlatform('linux');
    // Only exact matches are rejected; the per-user layout Nx builds itself lives
    // under these roots, so a prefix test would reject the default too.
    process.env.NX_SOCKET_DIR = '/tmp/.nx/sockets/mine';

    expect(getSocketDir()).toBe('/tmp/.nx/sockets/mine');
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
      expect(dir.startsWith(USER_SOCKET_ROOT + '/')).toBe(true);
      expect(getNxSocketRoot()).toBe('/tmp/.nx/sockets');
    }
  );

  it('ignores an empty NX_SOCKET_DIR shadowing a valid legacy value', () => {
    setPlatform('linux');
    // What a half-finished migration to the new variable name looks like.
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

  it('does not relax the shared root when an explicit socket dir is configured', () => {
    setPlatform('linux');
    process.env.NX_SOCKET_DIR = '/tmp/nx-custom-sock';

    getSocketDir();

    // Only the configured dir is touched; the default stable root is left alone.
    expect(ensureSafeSharedRoot).not.toHaveBeenCalled();
  });

  it('falls back rather than creating anything under an unsafe shared root', () => {
    setPlatform('linux');
    (ensureSafeSharedRoot as jest.Mock).mockReturnValueOnce(false);

    const dir = getSocketDir();

    expect(dir).toBe(DAEMON_DIR_FOR_CURRENT_WORKSPACE);
    expect(ensureOwnedPrivateDir).not.toHaveBeenCalledWith(USER_SOCKET_ROOT);
  });

  it('stops at the first unsafe root rather than creating the one below it', () => {
    setPlatform('linux');
    // The inner root is absent on a fresh machine, so it is the easier to plant.
    (ensureSafeSharedRoot as jest.Mock).mockReturnValueOnce(true);
    (ensureSafeSharedRoot as jest.Mock).mockReturnValueOnce(false);

    expect(getSocketDir()).toBe(DAEMON_DIR_FOR_CURRENT_WORKSPACE);
    expect(ensureSafeSharedRoot).toHaveBeenCalledWith('/tmp/.nx');
    expect(ensureSafeSharedRoot).toHaveBeenCalledWith('/tmp/.nx/sockets');
  });

  // The win32 short-circuit lives in ensureSafeSharedRoot, mocked out here;
  // covered live in utils/owned-private-dir.spec.ts.
});

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
