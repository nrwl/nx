import { chmodSync, mkdirSync } from 'node:fs';
import { platform, tmpdir as osTmpdir } from 'node:os';
import { join } from 'node:path';
import { tmpdir as systemTmpDir } from 'tmp';
import {
  getNxSocketRoot,
  getPluginSocketDir,
  getSocketDir,
  InvalidSocketDirConfigured,
} from './tmp-dir';
import {
  ensureOwnedPrivateDir,
  relaxSharedRootToSticky,
} from '../utils/owned-private-dir';

jest.mock('../utils/owned-private-dir', () => ({
  ensureOwnedPrivateDir: jest.fn(() => true),
  relaxSharedRootToSticky: jest.fn(),
}));

jest.mock('node:fs', () => {
  const actual = jest.requireActual('node:fs');
  return {
    ...actual,
    mkdirSync: jest.fn(),
    chmodSync: jest.fn(),
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

  // The leaf is created non-recursively with mode 0700 via
  // ensureOwnedPrivateDir, and only its parent chain is created recursively.
  // Creating the whole path recursively and chmod-ing it afterwards would adopt
  // a pre-planted symlink; see owned-private-dir.spec.ts for that property.
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

    // The individual socket dir is owner-only, but the shared root it lives
    // under is relaxed to 0o1777 (like /tmp) so other users on the machine can
    // create their own owner-only socket dirs alongside it.
    // Each root is relaxed by its own call: sharing one try block meant a
    // failure on the outer root skipped the inner one, locking other users out.
    expect(relaxSharedRootToSticky).toHaveBeenCalledWith('/tmp/.nx');
    expect(relaxSharedRootToSticky).toHaveBeenCalledWith('/tmp/.nx/sockets');
  });

  it('gives the daemon and plugin sockets distinct directories', () => {
    setPlatform('linux');

    expect(getSocketDir()).not.toBe(getPluginSocketDir());
  });

  it('throws InvalidSocketDirConfigured when the socket dir resolves to the system temp dir', () => {
    setPlatform('linux');
    // Pointing NX_SOCKET_DIR at the raw system temp dir is invalid config: every
    // user on the machine can access it, so it can never be locked down to us.
    // This must fail loudly rather than silently substituting a default.
    process.env.NX_SOCKET_DIR = systemTmpDir;

    expect(() => getSocketDir()).toThrow(InvalidSocketDirConfigured);
    // The shared temp dir must never be created or chmod-ed on the way to the
    // throw.
    expect(mkdirSync).not.toHaveBeenCalled();
    expect(chmodSync).not.toHaveBeenCalled();
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

  it('does not chmod on Windows (named pipes rely on their default DACL)', () => {
    setPlatform('win32');

    getSocketDir();
    getPluginSocketDir();

    expect(chmodSync).not.toHaveBeenCalled();
  });
});

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
