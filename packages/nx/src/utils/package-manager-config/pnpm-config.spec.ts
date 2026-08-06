import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { homedir, tmpdir } from 'os';
import { join } from 'path';
import { getPnpmConfigDir, readPnpmYamlConfig } from './pnpm-config';

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

describe('readPnpmYamlConfig', () => {
  let dir: string;
  const path = () => join(dir, 'pnpm-workspace.yaml');

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'nx-pnpm-cfg-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns null for an absent file and the object for a map', () => {
    expect(readPnpmYamlConfig(path())).toBeNull();
    writeFileSync(path(), 'registries:\n  default: https://reg.example.com/\n');
    expect(readPnpmYamlConfig(path())).toEqual({
      registries: { default: 'https://reg.example.com/' },
    });
  });

  it('returns an empty object for an empty file', () => {
    writeFileSync(path(), '');
    expect(readPnpmYamlConfig(path())).toEqual({});
  });

  it('reports a file that does not parse as unusable', () => {
    writeFileSync(path(), 'registries:\n\tdefault: tab-indented\n');
    expect(readPnpmYamlConfig(path())).toBe('unusable');
  });

  it.each([
    // A symlink loop is the portable way to fail the read with an errno that
    // root cannot bypass, unlike a permission bit.
    ['a symlink loop', () => symlinkSync(path(), path())],
    ["a directory in the file's place", () => mkdirSync(path())],
  ])(
    'reports a file it cannot open (%s) as unusable, the way pnpm rethrows every errno but ENOENT',
    (_label, fault) => {
      fault();
      expect(readPnpmYamlConfig(path())).toBe('unusable');
    }
  );

  it('reports a path through a non-directory as unusable, leaving the absent call to the caller that looks the file up', () => {
    writeFileSync(path(), '');
    expect(readPnpmYamlConfig(join(path(), 'pnpm-workspace.yaml'))).toBe(
      'unusable'
    );
  });

  it.each([
    ['a bare scalar', 'just-a-string\n'],
    ['a sequence', '- a\n- b\n'],
  ])(
    'reports non-object content (%s) as unusable, the way pnpm dies on it',
    (_label, contents) => {
      writeFileSync(path(), contents);
      expect(readPnpmYamlConfig(path())).toBe('unusable');
    }
  );
});
