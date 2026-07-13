import { describe, expect, it } from 'vitest';
import { extractInlineSourceMap } from './inline-source-map';

describe('extractInlineSourceMap', () => {
  // Assembled at runtime so tools scanning this file for sourcemap comments
  // do not mistake the literal for a real one.
  const inlineComment = (map: string) =>
    '//# sourceMapping' +
    `URL=data:application/json;base64,${Buffer.from(map).toString('base64')}`;

  it('should split a valid inline sourcemap off the code', () => {
    const map = JSON.stringify({ version: 3, sources: ['foo.ts'] });
    const code = `const foo = 1;\n${inlineComment(map)}`;

    expect(extractInlineSourceMap(code)).toEqual(['const foo = 1;', map]);
  });

  it('should return the code unchanged when there is no inline sourcemap', () => {
    const code = 'const foo = 1;';

    expect(extractInlineSourceMap(code)).toEqual([code, undefined]);
  });

  it('should strip the comment and return no map when the sourcemap is malformed', () => {
    const code = `const foo = 1;\n${inlineComment('{not json')}`;

    expect(extractInlineSourceMap(code)).toEqual(['const foo = 1;', undefined]);
  });
});
