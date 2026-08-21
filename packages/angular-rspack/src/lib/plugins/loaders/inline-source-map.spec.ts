import { describe, expect, it } from 'vitest';
import {
  extractInlineSourceMap,
  isForwardableSourceMap,
} from './inline-source-map';

describe('extractInlineSourceMap', () => {
  // Assembled at runtime so tools scanning this file for sourcemap comments
  // do not mistake the literal for a real one.
  const inlineComment = (map: string, charset = '') =>
    '//# sourceMapping' +
    `URL=data:application/json;${charset}base64,${Buffer.from(map).toString(
      'base64'
    )}`;

  it('should split a valid inline sourcemap off the code', () => {
    const map = JSON.stringify({
      version: 3,
      sources: ['foo.ts'],
      mappings: 'AAAA',
    });
    const code = `const foo = 1;\n${inlineComment(map)}`;

    expect(extractInlineSourceMap(code)).toEqual({
      code: 'const foo = 1;',
      map,
      strippedComment: true,
    });
  });

  it('should split an inline sourcemap with a charset segment', () => {
    const map = JSON.stringify({ mappings: 'AAAA' });
    const code = `const foo = 1;\n${inlineComment(map, 'charset=utf-8;')}`;

    expect(extractInlineSourceMap(code)).toEqual({
      code: 'const foo = 1;',
      map,
      strippedComment: true,
    });
  });

  it('should not leave a stray carriage return when the code uses CRLF', () => {
    const map = JSON.stringify({ mappings: 'AAAA' });
    const code = `const foo = 1;\r\n${inlineComment(map)}\r\n`;

    expect(extractInlineSourceMap(code)).toEqual({
      code: 'const foo = 1;',
      map,
      strippedComment: true,
    });
  });

  it('should return the code unchanged when there is no inline sourcemap', () => {
    const code = 'const foo = 1;';

    expect(extractInlineSourceMap(code)).toEqual({
      code,
      map: undefined,
      strippedComment: false,
    });
  });

  it('should strip the comment and return no map when the sourcemap is malformed', () => {
    const code = `const foo = 1;\n${inlineComment('{not json')}`;

    expect(extractInlineSourceMap(code)).toEqual({
      code: 'const foo = 1;',
      map: undefined,
      strippedComment: true,
    });
  });

  it('should strip the comment and return no map when the map would be rejected by rspack', () => {
    const code = `const foo = 1;\n${inlineComment(
      JSON.stringify({ version: 3, sources: [42], mappings: 'AAAA' })
    )}`;

    expect(extractInlineSourceMap(code)).toEqual({
      code: 'const foo = 1;',
      map: undefined,
      strippedComment: true,
    });
  });

  it('should strip a comment referencing an external map file and return no map', () => {
    const code = `const foo = 1;\n//# sourceMapping` + `URL=foo.js.map\n`;

    expect(extractInlineSourceMap(code)).toEqual({
      code: 'const foo = 1;',
      map: undefined,
      strippedComment: true,
    });
  });

  it('should split an inline sourcemap in a block comment off the code', () => {
    const map = JSON.stringify({ mappings: 'AAAA' });
    const code =
      `const foo = 1;\n/*# sourceMapping` +
      `URL=data:application/json;base64,${Buffer.from(map).toString(
        'base64'
      )} */\n`;

    expect(extractInlineSourceMap(code)).toEqual({
      code: 'const foo = 1;',
      map,
      strippedComment: true,
    });
  });

  it('should strip a block comment referencing an external map file', () => {
    const code = `const foo = 1;\n/*# sourceMapping` + `URL=foo.js.map */\n`;

    expect(extractInlineSourceMap(code)).toEqual({
      code: 'const foo = 1;',
      map: undefined,
      strippedComment: true,
    });
  });

  it('should split an inline sourcemap in a legacy //@ comment off the code', () => {
    const map = JSON.stringify({ mappings: 'AAAA' });
    const code =
      `const foo = 1;\n//@ sourceMapping` +
      `URL=data:application/json;base64,${Buffer.from(map).toString(
        'base64'
      )}\n`;

    expect(extractInlineSourceMap(code)).toEqual({
      code: 'const foo = 1;',
      map,
      strippedComment: true,
    });
  });

  it('should strip a legacy /*@ block comment referencing an external map file', () => {
    const code = `const foo = 1;\n/*@ sourceMapping` + `URL=foo.js.map */\n`;

    expect(extractInlineSourceMap(code)).toEqual({
      code: 'const foo = 1;',
      map: undefined,
      strippedComment: true,
    });
  });

  it('should accept a tab between the marker and the URL', () => {
    const code = `const foo = 1;\n//#\tsourceMapping` + `URL=foo.js.map\n`;

    expect(extractInlineSourceMap(code)).toEqual({
      code: 'const foo = 1;',
      map: undefined,
      strippedComment: true,
    });
  });

  it('should not strip a block comment spanning multiple lines', () => {
    const code = `const foo = 1;\n/*# sourceMapping` + `URL=foo.js.map\n*/\n`;

    expect(extractInlineSourceMap(code)).toEqual({
      code,
      map: undefined,
      strippedComment: false,
    });
  });

  it('should only strip a trailing comment', () => {
    const map = JSON.stringify({ mappings: 'AAAA' });
    const code = `const foo = 1;\n${inlineComment(map)}\nconst bar = 2;\n`;

    expect(extractInlineSourceMap(code)).toEqual({
      code,
      map: undefined,
      strippedComment: false,
    });
  });
});

// The accept/reject rules mirror rspack's deserializer, which fails the
// module build on anything it rejects. Verified against rspack 1.6 and 2.0:
// only `mappings` is required, other fields are optional and null-tolerant
// but type-checked when present.
describe('isForwardableSourceMap', () => {
  const base = { version: 3, sources: ['a.ts'], names: [], mappings: 'AAAA' };

  it.each([
    ['a minimal map with only mappings', { mappings: 'AAAA' }],
    ['a map without version', { sources: ['a.ts'], mappings: 'AAAA' }],
    ['a map with a string version', { ...base, version: '3' }],
    ['a map with empty mappings', { ...base, mappings: '' }],
    ['a map with null sources', { ...base, sources: null }],
    ['a map with a null sources element', { ...base, sources: [null] }],
    ['a map with a null names element', { ...base, names: [null] }],
    [
      'a map with a null sourcesContent element',
      { ...base, sourcesContent: [null] },
    ],
    [
      'a map with null optional fields',
      { ...base, file: null, sourceRoot: null, debugId: null },
    ],
    ['a map with an ignoreList', { ...base, ignoreList: [0, 4294967295] }],
    ['a map with unknown fields', { ...base, somethingElse: 42 }],
  ])('should accept %s', (_, value) => {
    expect(isForwardableSourceMap(value)).toBe(true);
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['a string', '{"mappings":"AAAA"}'],
    ['a map without mappings', { version: 3, sources: ['a.ts'] }],
    ['a map with non-string mappings', { ...base, mappings: 42 }],
    ['a map with a non-string sources element', { ...base, sources: [42] }],
    ['a map with a non-string names element', { ...base, names: [1] }],
    [
      'a map with a non-string sourcesContent element',
      { ...base, sourcesContent: [42] },
    ],
    ['a map with a non-string file', { ...base, file: 42 }],
    ['a map with a non-string sourceRoot', { ...base, sourceRoot: 1 }],
    ['a map with a non-string debugId', { ...base, debugId: 1 }],
    [
      'a map with a non-numeric ignoreList element',
      { ...base, ignoreList: ['a'] },
    ],
    ['a map with a negative ignoreList element', { ...base, ignoreList: [-1] }],
    [
      'a map with a fractional ignoreList element',
      { ...base, ignoreList: [1.5] },
    ],
    [
      'a map with an ignoreList element above the u32 range',
      { ...base, ignoreList: [4294967296] },
    ],
  ])('should reject %s', (_, value) => {
    expect(isForwardableSourceMap(value)).toBe(false);
  });
});
