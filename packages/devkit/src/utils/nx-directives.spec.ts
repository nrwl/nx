import { parseNxDirectives } from './nx-directives';

describe('parseNxDirectives', () => {
  it('reads the directives of the leading comment block by name, in order', () => {
    expect(
      parseNxDirectives(
        '// @nx-a: one\r\n/**\n * Checkout flow.\n * @nx-b: two\n * @nx-a:three \n */\nimport x from "y";\n'
      )
    ).toEqual(
      new Map([
        ['a', ['one', 'three']],
        ['b', ['two']],
      ])
    );
    expect(parseNxDirectives('/* @nx-a: one */\ntest();\n')).toEqual(
      new Map([['a', ['one']]])
    );
  });

  it('skips blank lines, a shebang and other comments before a directive', () => {
    expect(
      parseNxDirectives(
        '#!/usr/bin/env node\n\n/// <reference types="x" />\n/**\n * Copyright\n */\n\n// @nx-a: one\n'
      )
    ).toEqual(new Map([['a', ['one']]]));
  });

  it('stops at the first line that is not a comment', () => {
    for (const content of [
      'import x from "y";\n// @nx-a: one\n',
      '/* header */ const x = 1;\n// @nx-a: one\n',
      'test("// @nx-a: one", () => {});\n',
    ]) {
      expect(parseNxDirectives(content)).toEqual(new Map());
    }
  });
});
