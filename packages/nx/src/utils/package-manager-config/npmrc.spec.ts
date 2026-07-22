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

  it('returns a double-quoted value verbatim when it is not valid JSON', () => {
    // ini's unsafe() JSON-decodes double-quoted values; an invalid escape makes
    // JSON.parse throw, so the raw value (quotes included) is returned as-is.
    expect(read('key="bad\\escape"')?.get('key')).toBe('"bad\\escape"');
  });

  it('skips blank lines and full-line comments', () => {
    const map = read(
      ['# comment', '; comment', '', 'registry=https://r/'].join('\n')
    );
    expect(map?.size).toBe(1);
    expect(map?.get('registry')).toBe('https://r/');
  });

  it('breaks lines on a bare CR the way ini does', () => {
    // ini splits on /[\r\n]+/, so the comment ends at the CR and the registry is
    // a line of its own. Reading only /\r?\n/ would hide it inside the comment
    // while the spawned npm still honors it.
    const map = read('; note\rregistry=https://r/');
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

  it('strips a [] array suffix to the bare key (ini bracketedArray)', () => {
    const map = read('ca[]=/etc/ssl/ca.pem');
    expect(map?.get('ca')).toBe('/etc/ssl/ca.pem');
    expect(map?.has('ca[]')).toBe(false);
  });

  it('joins repeated ca[] entries on a blank line (npm env array encoding)', () => {
    expect(
      read('ca[]=-----CA-ONE-----\nca[]=-----CA-TWO-----')?.get('ca')
    ).toBe('-----CA-ONE-----\n\n-----CA-TWO-----');
  });

  it('flags bracketed entries as arrays in readNpmrcEntries', () => {
    writeFileSync(path, 'ca[]=a\nca[]=b');
    expect(readNpmrcEntries(path)).toEqual([
      { key: 'ca', value: 'a', array: true },
      { key: 'ca', value: 'b', array: true },
    ]);
  });
});
