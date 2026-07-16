import { describe, expect, it } from 'vitest';
import {
  extractInlineSourceMap,
  extractInlineSourceMapCached,
} from './inline-source-map';

const map = {
  version: 3,
  sources: ['app.component.ts'],
  sourcesContent: ['export class AppComponent {}'],
  mappings: 'AAAA',
  names: [],
};
const encode = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString('base64');
// Built via concatenation so bundlers/test transforms don't treat the
// literal token in this source file as a real sourcemap reference.
const inlineComment = (data: string, charset = true) =>
  `//# source` +
  `MappingURL=data:application/json;${
    charset ? 'charset=utf-8;' : ''
  }base64,${data}`;

describe('extractInlineSourceMap', () => {
  it('returns the code untouched when there is no inline sourcemap', () => {
    expect(extractInlineSourceMap('const a = 1;')).toEqual({
      code: 'const a = 1;',
      map: undefined,
    });
  });

  it('extracts a base64 inline sourcemap as a JSON string and strips the comment', () => {
    const code = `const a = 1;\n${inlineComment(encode(map))}\n`;

    const result = extractInlineSourceMap(code);
    expect(result.code).toBe('const a = 1;');
    expect(JSON.parse(result.map!)).toEqual(map);
  });

  it('handles the comment without a charset segment', () => {
    const code = `const a = 1;\n${inlineComment(encode(map), false)}`;

    const result = extractInlineSourceMap(code);
    expect(result.code).toBe('const a = 1;');
    expect(JSON.parse(result.map!)).toEqual(map);
  });

  it('strips a CRLF that precedes the comment', () => {
    const code = `const a = 1;\r\n${inlineComment(encode(map))}`;

    const result = extractInlineSourceMap(code);
    expect(result.code).toBe('const a = 1;');
    expect(JSON.parse(result.map!)).toEqual(map);
  });

  it('tolerates extra trailing newlines after the comment', () => {
    const code = `const a = 1;\n${inlineComment(encode(map))}\n\n`;

    const result = extractInlineSourceMap(code);
    expect(result.code).toBe('const a = 1;');
    expect(JSON.parse(result.map!)).toEqual(map);
  });

  it('passes the code through when the embedded map is malformed', () => {
    // Valid base64 that decodes to text which is not valid JSON.
    const notJson = Buffer.from('not json').toString('base64');
    const code = `const a = 1;\n${inlineComment(notJson, false)}`;

    expect(extractInlineSourceMap(code)).toEqual({
      code,
      map: undefined,
    });
  });

  // Any JSON value that is not a raw v3 sourcemap would fail the module
  // build when forwarded to Rspack's loader callback — including well-shaped
  // maps with wrongly typed nested fields, which rspack's deserializer
  // rejects with `bad json: ExpectedString`.
  it.each([
    ['an empty object', {}],
    ['null', null],
    ['an array', []],
    ['a map missing v3 fields', { version: 3 }],
    ['a map with a non-string sources element', { ...map, sources: [42] }],
    ['a map with a non-string names element', { ...map, names: [1] }],
    [
      'a map with a non-string sourcesContent element',
      { ...map, sourcesContent: [42] },
    ],
    ['a map with a non-string file', { ...map, file: 42 }],
    ['a map with a non-string sourceRoot', { ...map, sourceRoot: 1 }],
    ['a map with a non-string debugId', { ...map, debugId: 1 }],
    ['a map with a non-numeric ignoreList', { ...map, ignoreList: ['a'] }],
    // ignoreList entries are u32 on the rspack side (`ExpectedUnsigned`).
    ['a map with a negative ignoreList entry', { ...map, ignoreList: [-1] }],
    ['a map with a fractional ignoreList entry', { ...map, ignoreList: [1.5] }],
    [
      'a map with an ignoreList entry above u32 range',
      { ...map, ignoreList: [4294967296] },
    ],
  ])('passes the code through when the payload is %s', (_, payload) => {
    const code = `const a = 1;\n${inlineComment(encode(payload))}`;

    expect(extractInlineSourceMap(code)).toEqual({
      code,
      map: undefined,
    });
  });

  // Optional fields may be null (rspack treats a JSON null like an absent
  // optional field) and sourcesContent entries may be null per the spec.
  it.each([
    ['null optional fields', { ...map, file: null, sourceRoot: null }],
    ['a null sourcesContent entry', { ...map, sourcesContent: [null] }],
    ['a numeric ignoreList', { ...map, ignoreList: [0] }],
  ])('accepts a map with %s', (_, payload) => {
    const code = `const a = 1;\n${inlineComment(encode(payload))}`;

    const result = extractInlineSourceMap(code);
    expect(result.code).toBe('const a = 1;');
    expect(JSON.parse(result.map!)).toEqual(payload);
  });
});

describe('extractInlineSourceMapCached', () => {
  it('reuses the extraction result for the same cached contents instance', () => {
    const code = `const a = 1;\n${inlineComment(encode(map))}`;

    const first = extractInlineSourceMapCached('/memo/app.ts', code);
    const second = extractInlineSourceMapCached('/memo/app.ts', code);

    expect(second).toBe(first);
    expect(first.code).toBe('const a = 1;');
    expect(JSON.parse(first.map!)).toEqual(map);
  });

  it('re-extracts when the cached contents are replaced', () => {
    const key = '/memo/replaced.ts';
    const first = extractInlineSourceMapCached(
      key,
      `const a = 1;\n${inlineComment(encode(map))}`
    );

    const updatedMap = { ...map, sources: ['app.ts'] };
    const second = extractInlineSourceMapCached(
      key,
      `const b = 2;\n${inlineComment(encode(updatedMap))}`
    );

    expect(second).not.toBe(first);
    expect(second.code).toBe('const b = 2;');
    expect(JSON.parse(second.map!)).toEqual(updatedMap);
  });

  it('decodes Uint8Array contents', () => {
    const code = `const a = 1;\n${inlineComment(encode(map))}`;

    const result = extractInlineSourceMapCached(
      '/memo/buffer.ts',
      new Uint8Array(Buffer.from(code))
    );

    expect(result.code).toBe('const a = 1;');
    expect(JSON.parse(result.map!)).toEqual(map);
  });
});
