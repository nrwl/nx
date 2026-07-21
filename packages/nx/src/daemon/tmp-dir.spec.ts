import { chmodSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'tmp';
import {
  getPluginSocketDir,
  getSocketDir,
  InvalidSocketDirConfigured,
} from './tmp-dir';

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

  it('creates the daemon socket directory owner-only and enforces it with chmod', () => {
    setPlatform('linux');

    const dir = getSocketDir();

    expect(mkdirSync).toHaveBeenCalledWith(dir, {
      recursive: true,
      mode: 0o700,
    });
    expect(chmodSync).toHaveBeenCalledWith(dir, 0o700);
  });

  it('creates the plugin socket directory owner-only and enforces it with chmod', () => {
    setPlatform('linux');

    const dir = getPluginSocketDir();

    expect(mkdirSync).toHaveBeenCalledWith(dir, {
      recursive: true,
      mode: 0o700,
    });
    expect(chmodSync).toHaveBeenCalledWith(dir, 0o700);
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
    process.env.NX_SOCKET_DIR = tmpdir;

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
    expect(chmodSync).toHaveBeenCalledWith('/tmp/nx-custom-sock', 0o700);
  });

  it('does not chmod on Windows (named pipes rely on their default DACL)', () => {
    setPlatform('win32');

    getSocketDir();
    getPluginSocketDir();

    expect(chmodSync).not.toHaveBeenCalled();
  });
});
