import { type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './add-file-extensions-to-overrides';

describe('add-file-extensions-to-overrides', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add .cjs, .mjs, .cts, .mts file extensions to overrides converted using convert-to-flat-config', async () => {
    tree.write(
      'eslint.config.js',
      `const { FlatCompat } = require('@eslint/eslintrc');
const js = require('@eslint/js');
const nxEslintPlugin = require('@nx/eslint-plugin');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

module.exports = [
  ...compat
    .config({
      extends: ['plugin:@nx/typescript'],
    })
    .map((config) => ({
      ...config,
      files: ['**/*.ts', '**/*.tsx'],
      rules: {
        ...config.rules,
      },
    })),
  ...compat
    .config({
      extends: ['plugin:@nx/javascript'],
    })
    .map((config) => ({
      ...config,
      files: ['**/*.js', '**/*.jsx'],
      rules: {
        ...config.rules,
      },
    })),
];`
    );

    await migration(tree);

    const updated = tree.read('eslint.config.js', 'utf-8');
    expect(updated).toMatchInlineSnapshot(`
      "const { FlatCompat } = require('@eslint/eslintrc');
      const js = require('@eslint/js');
      const nxEslintPlugin = require('@nx/eslint-plugin');

      const compat = new FlatCompat({
        baseDirectory: __dirname,
        recommendedConfig: js.configs.recommended,
      });

      module.exports = [
        ...compat
          .config({
            extends: ['plugin:@nx/typescript'],
          })
          .map((config) => ({
            ...config,
            files: ['**/*.ts', '**/*.tsx', '**/*.cts', '**/*.mts'],
            rules: {
              ...config.rules,
            },
          })),
        ...compat
          .config({
            extends: ['plugin:@nx/javascript'],
          })
          .map((config) => ({
            ...config,
            files: ['**/*.js', '**/*.jsx', '**/*.cjs', '**/*.mjs'],
            rules: {
              ...config.rules,
            },
          })),
      ];"
    `);
  });

  it('should handle duplicates', async () => {
    tree.write(
      'eslint.config.js',
      `const { FlatCompat } = require('@eslint/eslintrc');
const js = require('@eslint/js');
const nxEslintPlugin = require('@nx/eslint-plugin');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

module.exports = [
  ...compat
    .config({
      extends: ['plugin:@nx/javascript'],
    })
    .map((config) => ({
      ...config,
      files: ['**/*.js', '**/*.jsx', '**/*.mjs'],
      rules: {
        ...config.rules,
      },
    })),
];`
    );

    await migration(tree);

    const updated = tree.read('eslint.config.js', 'utf-8');
    expect(updated).toMatchInlineSnapshot(`
      "const { FlatCompat } = require('@eslint/eslintrc');
      const js = require('@eslint/js');
      const nxEslintPlugin = require('@nx/eslint-plugin');

      const compat = new FlatCompat({
        baseDirectory: __dirname,
        recommendedConfig: js.configs.recommended,
      });

      module.exports = [
        ...compat
          .config({
            extends: ['plugin:@nx/javascript'],
          })
          .map((config) => ({
            ...config,
            files: ['**/*.js', '**/*.jsx', '**/*.mjs', '**/*.cjs'],
            rules: {
              ...config.rules,
            },
          })),
      ];"
    `);
  });

  it('should not update if plugin:@nx/javascript and plugin:@nx/typescript are not used', async () => {
    const original = `const { FlatCompat } = require('@eslint/eslintrc');
const js = require('@eslint/js');
const nxEslintPlugin = require('@nx/eslint-plugin');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

module.exports = [
  ...compat
    .config({
      extends: ['plugin:@acme/foo'],
    })
    .map((config) => ({
      ...config,
      files: ['**/*.ts', '**/*.tsx'],
      rules: {
        ...config.rules,
      },
    })),
  ...compat
    .config({
      extends: ['plugin:@acme/bar'],
    })
    .map((config) => ({
      ...config,
      files: ['**/*.js', '**/*.jsx'],
      rules: {
        ...config.rules,
      },
    })),
];`;
    tree.write('eslint.config.js', original);

    await migration(tree);

    const updated = tree.read('eslint.config.js', 'utf-8');
    expect(updated).toEqual(original);
  });
});
