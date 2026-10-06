import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { getBunGlobalConfigBase, readBunfigRaw } from './bunfig';

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

// bun looks past a bunfig.toml it cannot open and resolves on (measured on
// 1.3.13: absent, symlink loop, directory and EACCES all exit 0, while a
// readable one exits 1 naming the registry it declares), yet hard-errors on one
// its TOML parser rejects. readBunfigInstall branches on exactly that split, so
// the two failures cannot collapse into one state here.
describe('readBunfigRaw', () => {
  let dir: string;
  const path = () => join(dir, 'bunfig.toml');

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'nx-bunfig-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns null for an absent file and the table for a valid one', () => {
    expect(readBunfigRaw(path())).toBeNull();
    writeFileSync(path(), '[install]\nregistry = "https://reg.example.com/"\n');
    expect(readBunfigRaw(path())).toEqual({
      install: { registry: 'https://reg.example.com/' },
    });
  });

  it('returns an empty table for an empty file', () => {
    writeFileSync(path(), '');
    expect(readBunfigRaw(path())).toEqual({});
  });

  it('returns null for a path through a non-directory', () => {
    writeFileSync(path(), '');
    expect(readBunfigRaw(join(path(), 'bunfig.toml'))).toBeNull();
  });

  it.each([
    // A symlink loop is the portable way to fail the read with an errno root
    // cannot bypass, unlike a permission bit.
    ['a symlink loop', () => symlinkSync(path(), path())],
    ["a directory in the file's place", () => mkdirSync(path())],
  ])('reports a file it cannot open (%s) as unreadable', (_label, fault) => {
    fault();
    expect(readBunfigRaw(path())).toBe('unreadable');
  });

  it("reports content bun's own TOML parser rejects as invalid", () => {
    writeFileSync(path(), '[install\nregistry = "https://reg.example.com/"\n');
    expect(readBunfigRaw(path())).toBe('invalid');
  });
});
