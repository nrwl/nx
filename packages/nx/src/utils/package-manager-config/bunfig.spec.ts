import { getBunGlobalConfigBase } from './bunfig';

describe('getBunGlobalConfigBase', () => {
  it('returns XDG_CONFIG_HOME when set', () => {
    expect(
      getBunGlobalConfigBase({ XDG_CONFIG_HOME: '/xdg', HOME: '/home' })
    ).toBe('/xdg');
  });

  it('treats a set-but-empty XDG_CONFIG_HOME as present and does not fall back to HOME', () => {
    expect(getBunGlobalConfigBase({ XDG_CONFIG_HOME: '', HOME: '/home' })).toBe(
      ''
    );
  });

  it('falls back to HOME when XDG_CONFIG_HOME is absent', () => {
    expect(getBunGlobalConfigBase({ HOME: '/home' })).toBe('/home');
  });

  it('returns null when neither is set', () => {
    expect(getBunGlobalConfigBase({})).toBeNull();
  });
});
