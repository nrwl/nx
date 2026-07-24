import { getBunGlobalConfigBase } from './bunfig';

describe('getBunGlobalConfigBase', () => {
  const originalPlatform = Object.getOwnPropertyDescriptor(
    process,
    'platform'
  )!;
  function setPlatform(platform: NodeJS.Platform): void {
    Object.defineProperty(process, 'platform', { value: platform });
  }
  afterEach(() => {
    Object.defineProperty(process, 'platform', originalPlatform);
  });

  it('returns XDG_CONFIG_HOME when set', () => {
    expect(
      getBunGlobalConfigBase({ XDG_CONFIG_HOME: '/xdg', HOME: '/home' })
    ).toBe('/xdg');
  });

  it('treats a set-but-empty XDG_CONFIG_HOME as present and does not fall back to the home dir', () => {
    expect(getBunGlobalConfigBase({ XDG_CONFIG_HOME: '', HOME: '/home' })).toBe(
      ''
    );
  });

  it('returns null when nothing is set', () => {
    expect(getBunGlobalConfigBase({})).toBeNull();
  });

  describe('on POSIX', () => {
    beforeEach(() => setPlatform('linux'));

    it('falls back to HOME when XDG_CONFIG_HOME is absent', () => {
      expect(
        getBunGlobalConfigBase({ HOME: '/home', USERPROFILE: 'C:\\Users\\me' })
      ).toBe('/home');
    });
  });

  describe('on Windows', () => {
    beforeEach(() => setPlatform('win32'));

    it('falls back to USERPROFILE (not HOME) when XDG_CONFIG_HOME is absent', () => {
      expect(
        getBunGlobalConfigBase({ HOME: '/home', USERPROFILE: 'C:\\Users\\me' })
      ).toBe('C:\\Users\\me');
    });

    it('returns null when USERPROFILE is unset, even if HOME is set', () => {
      expect(getBunGlobalConfigBase({ HOME: '/home' })).toBeNull();
    });
  });
});
