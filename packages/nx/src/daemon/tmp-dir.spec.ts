import { mkdirSync } from 'node:fs';
import { platform, tmpdir as osTmpdir } from 'node:os';
import { join } from 'node:path';
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
  isRealDirectoryOrAbsent,
  relaxSharedRootToSticky,
} from '../utils/owned-private-dir';

jest.mock('../utils/owned-private-dir', () => ({
  ensureOwnedPrivateDir: jest.fn(() => true),
  isRealDirectoryOrAbsent: jest.fn(() => true),
  relaxSharedRootToSticky: jest.fn(),
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
    it('defaults to a stable common directory', () => {
      const expected =
        platform() === 'win32'
          ? join(osTmpdir(), '.nx', 'sockets')
          : '/tmp/.nx/sockets';
      expect(getNxSocketRoot()).toEqual(expected);
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
    expect(mkdirSync).toHaveBeenCalledWith('/tmp/.nx/sockets', {
      recursive: true,
    });
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

  it('falls back when the per-uid directory is not ours', () => {
    setPlatform('linux');
    (ensureOwnedPrivateDir as jest.Mock).mockReturnValueOnce(false);

    expect(getSocketDir()).toBe(DAEMON_DIR_FOR_CURRENT_WORKSPACE);
  });

  it('creates the plugin socket directory owner-only, separately from its parents', () => {
    setPlatform('linux');

    const dir = getPluginSocketDir();

    expect(ensureOwnedPrivateDir).toHaveBeenCalledWith(dir);
    expect(mkdirSync).toHaveBeenCalledWith('/tmp/.nx/sockets', {
      recursive: true,
    });
  });

  it('makes the shared socket root sticky + world-writable so other users can coexist', () => {
    setPlatform('linux');

    getSocketDir();

    // Relaxed so other users can create their own dirs alongside; each by its own
    // call, since one failing must not skip the other.
    expect(relaxSharedRootToSticky).toHaveBeenCalledWith('/tmp/.nx');
    expect(relaxSharedRootToSticky).toHaveBeenCalledWith('/tmp/.nx/sockets');
    // ...but never the per-uid directory, which must stay 0700.
    expect(relaxSharedRootToSticky).not.toHaveBeenCalledWith(USER_SOCKET_ROOT);
  });

  it('gives the daemon and plugin sockets distinct directories', () => {
    setPlatform('linux');

    expect(getSocketDir()).not.toBe(getPluginSocketDir());
  });

  it('throws InvalidSocketDirConfigured when the socket dir resolves to the system temp dir', () => {
    setPlatform('linux');
    // Every user can reach the system temp dir, so this must fail loudly rather
    // than silently substituting a default.
    process.env.NX_SOCKET_DIR = systemTmpDir;

    expect(() => getSocketDir()).toThrow(InvalidSocketDirConfigured);
    expect(mkdirSync).not.toHaveBeenCalled();
    expect(relaxSharedRootToSticky).not.toHaveBeenCalled();
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
    expect(relaxSharedRootToSticky).not.toHaveBeenCalled();
  });

  it('falls back rather than creating anything under a hostile shared root', () => {
    setPlatform('linux');
    (isRealDirectoryOrAbsent as jest.Mock).mockReturnValueOnce(false);

    const dir = getSocketDir();

    expect(dir).toBe(DAEMON_DIR_FOR_CURRENT_WORKSPACE);
    expect(relaxSharedRootToSticky).not.toHaveBeenCalled();
    expect(mkdirSync).not.toHaveBeenCalledWith('/tmp/.nx/sockets', {
      recursive: true,
    });
  });

  it('checks every shared root, not just the outer one', () => {
    setPlatform('linux');
    // The inner root is absent on a fresh machine, so it is the easier to plant.
    (isRealDirectoryOrAbsent as jest.Mock).mockReturnValueOnce(true);
    (isRealDirectoryOrAbsent as jest.Mock).mockReturnValueOnce(false);

    expect(getSocketDir()).toBe(DAEMON_DIR_FOR_CURRENT_WORKSPACE);
    expect(isRealDirectoryOrAbsent).toHaveBeenCalledWith('/tmp/.nx');
    expect(isRealDirectoryOrAbsent).toHaveBeenCalledWith('/tmp/.nx/sockets');
  });

  // The win32 short-circuit lives in relaxSharedRootToSticky, mocked out here;
  // covered live in utils/owned-private-dir.spec.ts.
});

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
