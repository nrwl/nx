import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { readNpmrcEntries, readNpmrcMap } from './npmrc';

describe('readNpmrcEntries / readNpmrcMap', () => {
  let dir: string;
  let path: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'nx-npmrc-'));
    path = join(dir, '.npmrc');
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const read = (contents: string) => {
    writeFileSync(path, contents);
    return readNpmrcMap(path);
  };

  it('returns null for a missing file', () => {
    expect(readNpmrcEntries(join(dir, 'nope'))).toBeNull();
    expect(readNpmrcMap(join(dir, 'nope'))).toBeNull();
  });

  it('strips surrounding double quotes (ini unsafe)', () => {
    expect(read('registry="https://reg-a.example.com/"')?.get('registry')).toBe(
      'https://reg-a.example.com/'
    );
  });

  it('strips surrounding single quotes', () => {
    expect(read("registry='https://reg-a.example.com/'")?.get('registry')).toBe(
      'https://reg-a.example.com/'
    );
  });

  it('truncates an unescaped inline ; comment', () => {
    expect(
      read('//reg.example.com/:_authToken=tok ; note')?.get(
        '//reg.example.com/:_authToken'
      )
    ).toBe('tok');
  });

  it('truncates an unescaped inline # comment', () => {
    expect(
      read('registry=https://reg-a.example.com/ # prod')?.get('registry')
    ).toBe('https://reg-a.example.com/');
  });

  it('honors a backslash escape before a comment char', () => {
    expect(read('key=a\\;b')?.get('key')).toBe('a;b');
  });

  it('skips blank lines and full-line comments', () => {
    const map = read(
      ['# comment', '; comment', '', 'registry=https://r/'].join('\n')
    );
    expect(map?.size).toBe(1);
    expect(map?.get('registry')).toBe('https://r/');
  });

  it('keeps last-write-wins for repeated keys', () => {
    expect(
      read('registry=https://a/\nregistry=https://b/')?.get('registry')
    ).toBe('https://b/');
  });

  it('preserves order and repeats in readNpmrcEntries', () => {
    writeFileSync(
      path,
      'minimum-release-age-exclude=a\nminimum-release-age-exclude=b'
    );
    expect(readNpmrcEntries(path)).toEqual([
      { key: 'minimum-release-age-exclude', value: 'a' },
      { key: 'minimum-release-age-exclude', value: 'b' },
    ]);
  });
});
