import { rmSync } from 'node:fs';
import { platform, tmpdir } from 'node:os';
import { join } from 'path';
import { getNxSocketRoot, getSocketDir } from './tmp-dir';

describe('socket dir', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NX_SOCKET_DIR;
    delete process.env.NX_DAEMON_SOCKET_DIR;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getNxSocketRoot', () => {
    it('should default to a stable common directory', () => {
      const expected =
        platform() === 'win32'
          ? join(tmpdir(), '.nx', 'sockets')
          : '/tmp/.nx/sockets';
      expect(getNxSocketRoot()).toEqual(expected);
    });

    it('should be overridable via NX_SOCKET_DIR', () => {
      process.env.NX_SOCKET_DIR = '/custom/socket/dir';
      expect(getNxSocketRoot()).toEqual('/custom/socket/dir');
    });

    it('should fall back to the legacy NX_DAEMON_SOCKET_DIR variable', () => {
      process.env.NX_DAEMON_SOCKET_DIR = '/legacy/socket/dir';
      expect(getNxSocketRoot()).toEqual('/legacy/socket/dir');
    });
  });

  describe('getSocketDir', () => {
    it('should place workspace-unique socket dirs under the common root', () => {
      expect(getSocketDir()).toMatch(
        new RegExp(`^${escapeRegExp(getNxSocketRoot())}`)
      );
      expect(getSocketDir()).not.toEqual(getNxSocketRoot());
    });

    it('should place already-unique sockets directly in the common root', () => {
      expect(getSocketDir(true)).toEqual(getNxSocketRoot());
    });

    it('should use NX_SOCKET_DIR verbatim when set', () => {
      const dir = join(tmpdir(), 'nx-socket-dir-spec');
      process.env.NX_SOCKET_DIR = dir;
      try {
        expect(getSocketDir()).toEqual(dir);
        expect(getSocketDir(true)).toEqual(dir);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
