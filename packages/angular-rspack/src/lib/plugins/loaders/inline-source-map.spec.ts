import { describe, expect, it } from 'vitest';
import { extractInlineSourceMap } from './inline-source-map';

describe('extractInlineSourceMap', () => {
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

  it('returns the code untouched when there is no inline sourcemap', () => {
    expect(extractInlineSourceMap('const a = 1;')).toEqual({
      code: 'const a = 1;',
      map: undefined,
    });
  });

  it('extracts a base64 inline sourcemap and strips the comment', () => {
    const code = `const a = 1;\n${inlineComment(encode(map))}\n`;

    expect(extractInlineSourceMap(code)).toEqual({
      code: 'const a = 1;',
      map,
    });
  });

  it('handles the comment without a charset segment', () => {
    const code = `const a = 1;\n${inlineComment(encode(map), false)}`;

    expect(extractInlineSourceMap(code)).toEqual({
      code: 'const a = 1;',
      map,
    });
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
});
