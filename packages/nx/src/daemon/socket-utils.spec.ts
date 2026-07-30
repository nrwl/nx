import { win32 } from 'node:path';
import { getPluginOsSocketPath, getPluginSocketFileName } from './socket-utils';
import { getPluginSocketDir, getSocketDirFallbackCause } from './tmp-dir';

jest.mock('./tmp-dir', () => ({
  getDaemonSocketDir: jest.fn(),
  getPluginSocketDir: jest.fn(),
  getSocketDir: jest.fn(),
  getSocketDirFallbackCause: jest.fn(),
}));

describe('socket path validation', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('keeps the plugin socket basename prefix and suffix short', () => {
    expect(getPluginSocketFileName('123-0-12345678')).toBe(
      'p123-0-12345678.sock'
    );
  });

  it('keeps the plugin socket within the current Windows budget for an 18-character username', () => {
    const windowsTempDir = win32.join(
      'C:\\Users',
      'u'.repeat(18),
      'AppData\\Local\\Temp'
    );
    const pluginSocketPath = win32.join(
      windowsTempDir,
      'f'.repeat(8),
      getPluginSocketFileName('9999999999-z-ffffffff')
    );

    expect(pluginSocketPath).toHaveLength(83);
    expect(pluginSocketPath.length).toBeLessThanOrEqual(95);
  });

  it('attaches the default-directory failure when its fallback is too long', () => {
    const cause = new Error('unsafe default socket root');
    (getPluginSocketDir as jest.Mock).mockReturnValue(`/${'a'.repeat(96)}`);
    (getSocketDirFallbackCause as jest.Mock).mockReturnValue(cause);

    let thrown!: Error;
    try {
      getPluginOsSocketPath('123-0-12345678');
      throw new Error('Expected socket path validation to fail');
    } catch (error) {
      thrown = error as Error;
    }

    expect(thrown.message).toContain('Nx fell back');
    expect(thrown.message).toContain('--verbose');
    expect(thrown.cause).toBe(cause);
  });

  it('does not claim an explicit short-path remedy was a fallback', () => {
    (getPluginSocketDir as jest.Mock).mockReturnValue(`/${'a'.repeat(96)}`);
    (getSocketDirFallbackCause as jest.Mock).mockReturnValue(undefined);

    expect(() => getPluginOsSocketPath('123-0-12345678')).toThrow(
      'Set NX_SOCKET_DIR to a shorter path'
    );

    try {
      getPluginOsSocketPath('123-0-12345678');
    } catch (error) {
      expect((error as Error).message).not.toContain('Nx fell back');
      expect((error as Error).cause).toBeUndefined();
    }
  });
});
