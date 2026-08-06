import { readStaticJsEslintrc } from './static-js-config';

describe('readStaticJsEslintrc', () => {
  function read(content: string) {
    return readStaticJsEslintrc(content, '.eslintrc.js');
  }

  it('should read an object built from literals', () => {
    const result = read(`'use strict';
      // A comment, and a trailing semicolon-free export.
      module.exports = {
        root: true,
        env: { browser: true, node: false },
        extends: ['../../.eslintrc.json'],
        rules: {
          'no-console': ['error', { allow: ['warn'] }],
          'max-len': [2, 120],
          'no-magic-numbers': ['warn', { ignore: [-1, 0, 1] }],
        },
        settings: { react: { version: 'detect' } },
        overrides: [{ files: ['*.ts'], rules: {} }],
      }`);

    expect(result).toEqual({
      kind: 'config',
      config: {
        root: true,
        env: { browser: true, node: false },
        extends: ['../../.eslintrc.json'],
        rules: {
          'no-console': ['error', { allow: ['warn'] }],
          'max-len': [2, 120],
          'no-magic-numbers': ['warn', { ignore: [-1, 0, 1] }],
        },
        settings: { react: { version: 'detect' } },
        overrides: [{ files: ['*.ts'], rules: {} }],
      },
    });
  });

  it('should read an object a JSDoc type cast wrapped in parentheses', () => {
    const result = read(
      `module.exports = /** @type {import('eslint').Linter.Config} */ ({
        rules: { 'no-console': 'error' },
      });`
    );

    expect(result).toEqual({
      kind: 'config',
      config: { rules: { 'no-console': 'error' } },
    });
  });

  it('should read numeric property keys and backtick values', () => {
    const result = read(
      'module.exports = { rules: { "no-console": `error`, 2: "off" } };'
    );

    expect(result).toEqual({
      kind: 'config',
      config: { rules: { 'no-console': 'error', 2: 'off' } },
    });
  });

  it.each([
    [
      'a require call',
      `const shared = require('./shared');\nmodule.exports = shared;`,
      'contains code other than a single "module.exports" assignment',
    ],
    [
      'a non-object export',
      `module.exports = [];`,
      '"module.exports" is not an object literal',
    ],
    [
      '__dirname',
      `module.exports = { parserOptions: { tsconfigRootDir: __dirname } };`,
      '"parserOptions.tsconfigRootDir" is not a literal value (__dirname)',
    ],
    [
      'a function call',
      `module.exports = { extends: [require.resolve('./base')] };`,
      '"extends[0]" is not a literal value',
    ],
    [
      'a template with substitutions',
      'module.exports = { rules: { "no-console": `${severity}` } };',
      '"rules.no-console" is not a literal value',
    ],
    [
      'a spread',
      `module.exports = { ...base, root: true };`,
      'is not a literal value (...base)',
    ],
    [
      'a computed key',
      `module.exports = { rules: { [ruleName]: 'error' } };`,
      'is not a literal value',
    ],
    [
      'no module.exports',
      `const config = { root: true };`,
      'contains code other than a single "module.exports" assignment',
    ],
    ['an empty file', ``, 'does not assign an object to "module.exports"'],
  ])('should refuse to read a config with %s', (_, content, reason) => {
    const result = read(content);

    expect(result.kind).toBe('unsupported');
    expect((result as { reason: string }).reason).toContain(reason);
  });

  it('should refuse to read a config that assigns module.exports twice', () => {
    const result = read(
      `module.exports = { root: true };\nmodule.exports = { root: false };`
    );

    expect(result).toEqual({
      kind: 'unsupported',
      reason: 'it assigns "module.exports" more than once',
    });
  });

  it('should not throw on a syntactically invalid file', () => {
    const result = read('module.exports = {');

    expect(result.kind).toBe('unsupported');
  });
});
