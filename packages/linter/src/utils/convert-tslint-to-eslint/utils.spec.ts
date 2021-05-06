import type { Linter } from 'eslint';
import { deduplicateOverrides } from './utils';

describe('deduplicateOverrides()', () => {
  it('should deduplicate overrides with identical values for "files"', () => {
    const initialOverrides: Linter.Config['overrides'] = [
      {
        files: ['*.ts'],
        env: {
          foo: true,
        },
        rules: {
          bar: 'error',
        },
      },
      {
        files: ['*.html'],
        rules: {},
      },
      {
        files: '*.ts',
        plugins: ['wat'],
        parserOptions: {
          qux: false,
        },
        rules: {
          bar: 'warn',
          baz: 'error',
        },
      },
      {
        files: ['*.ts'],
        extends: ['something'],
      },
    ];
    expect(deduplicateOverrides(initialOverrides)).toEqual([
      {
        files: ['*.ts'],
        env: {
          foo: true,
        },
        plugins: ['wat'],
        extends: ['something'],
        parserOptions: {
          qux: false,
        },
        rules: {
          bar: 'warn',
          baz: 'error',
        },
      },
      {
        files: ['*.html'],
        rules: {},
      },
    ]);
  });
});
