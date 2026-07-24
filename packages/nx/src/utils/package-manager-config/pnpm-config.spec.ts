import { homedir } from 'os';
import { join } from 'path';
import { getPnpmConfigDir } from './pnpm-config';

jest.mock('os', () => ({
  ...jest.requireActual('os'),
  homedir: jest.fn(),
}));

describe('getPnpmConfigDir', () => {
  const originalPlatform = Object.getOwnPropertyDescriptor(
    process,
    'platform'
  )!;
  function setPlatform(platform: NodeJS.Platform): void {
    Object.defineProperty(process, 'platform', { value: platform });
  }
  beforeEach(() => {
    (homedir as jest.Mock).mockReturnValue('/home/me');
  });
  afterEach(() => {
    Object.defineProperty(process, 'platform', originalPlatform);
    jest.clearAllMocks();
  });

  it('returns the XDG_CONFIG_HOME/pnpm dir when XDG_CONFIG_HOME is set', () => {
    setPlatform('linux');
    expect(getPnpmConfigDir({ XDG_CONFIG_HOME: '/xdg' })).toBe(
      join('/xdg', 'pnpm')
    );
  });

  it('prefers XDG_CONFIG_HOME over the platform default', () => {
    setPlatform('win32');
    expect(
      getPnpmConfigDir({ XDG_CONFIG_HOME: '/xdg', LOCALAPPDATA: 'C:/AppData' })
    ).toBe(join('/xdg', 'pnpm'));
  });

  describe('on macOS', () => {
    beforeEach(() => setPlatform('darwin'));

    it('uses ~/Library/Preferences/pnpm', () => {
      expect(getPnpmConfigDir({})).toBe(
        join('/home/me', 'Library/Preferences/pnpm')
      );
    });
  });

  describe('on Linux', () => {
    beforeEach(() => setPlatform('linux'));

    it('uses ~/.config/pnpm', () => {
      expect(getPnpmConfigDir({})).toBe(join('/home/me', '.config/pnpm'));
    });
  });

  describe('on Windows', () => {
    beforeEach(() => setPlatform('win32'));

    it('uses LOCALAPPDATA/pnpm/config when LOCALAPPDATA is set', () => {
      expect(getPnpmConfigDir({ LOCALAPPDATA: 'C:/AppData' })).toBe(
        join('C:/AppData', 'pnpm/config')
      );
    });

    it('falls back to ~/.config/pnpm when LOCALAPPDATA is unset', () => {
      expect(getPnpmConfigDir({})).toBe(join('/home/me', '.config/pnpm'));
    });
  });
});
