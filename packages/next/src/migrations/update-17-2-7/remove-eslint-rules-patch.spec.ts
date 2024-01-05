import { addProjectConfiguration, readJson, Tree, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';

import update from './remove-eslint-rules-patch';

describe('update-nx-next-dependency', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should handle projects without eslintrc file', async () => {
    tree.write('.eslintrc.json', '{}');

    addProjectConfiguration(tree, 'my-pkg', {
      root: 'packages/my-pkg',
    });

    await expect(update(tree)).resolves.not.toThrow();
  });

  it('should remove @next/next/no-html-link-for-pages in json configs', async () => {
    tree.write('.eslintrc.json', '{}');

    addProjectConfiguration(tree, 'my-pkg', {
      root: 'packages/my-pkg',
    });
    writeJson(tree, `packages/my-pkg/.eslintrc.json`, {
      root: true,
      ignorePatterns: ['!**/*'],
      plugins: ['@nx'],
      overrides: [
        {
          files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
          rules: {
            '@next/next/no-html-link-for-pages': ['error', 'apps/lint/pages'],
            'no-console': 'error',
          },
        },
        {
          files: ['**/*.*'],
          rules: { '@next/next/no-html-link-for-pages': 'off' },
        },
        {
          files: ['**/*.ts', '**/*.tsx'],
          rules: {},
        },
        {
          files: ['**/*.js', '**/*.jsx'],
          rules: {},
        },
      ],
    });

    await update(tree);

    expect(readJson(tree, `packages/my-pkg/.eslintrc.json`).overrides)
      .toMatchInlineSnapshot(`
      [
        {
          "files": [
            "**/*.ts",
            "**/*.tsx",
            "**/*.js",
            "**/*.jsx",
          ],
          "rules": {
            "@next/next/no-html-link-for-pages": [
              "error",
              "apps/lint/pages",
            ],
            "no-console": "error",
          },
        },
        {
          "files": [
            "**/*.ts",
            "**/*.tsx",
          ],
          "rules": {},
        },
        {
          "files": [
            "**/*.js",
            "**/*.jsx",
          ],
          "rules": {},
        },
      ]
    `);
  });

  it('should remove @next/next/no-html-link-for-pages in flat configs', async () => {
    tree.write('eslint.config.js', 'module.exports = []');

    addProjectConfiguration(tree, 'my-pkg', {
      root: 'packages/my-pkg',
    });
    tree.write(
      `packages/my-pkg/eslint.config.js`,
      `const { FlatCompat } = require('@eslint/eslintrc');
    const baseConfig = require('../../eslint.config.js');
    const js = require('@eslint/js');

    const compat = new FlatCompat({
      baseDirectory: __dirname,
      recommendedConfig: js.configs.recommended,
    });

    module.exports = [
      ...baseConfig,
      ...compat.extends(
        'plugin:@nx/react-typescript',
        'next',
        'next/core-web-vitals'
      ),
      {
        files: ['**/*.*'],
        rules: { '@next/next/no-html-link-for-pages': 'off' },
      },
      {
        files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
        rules: {
          '@next/next/no-html-link-for-pages': ['error', 'apps/lint/pages'],
          'no-console': 'error',
        },
      },
      {
        files: ['**/*.ts', '**/*.tsx'],
        rules: {},
      },
      {
        files: ['**/*.js', '**/*.jsx'],
        rules: {},
      },
      ...compat.config({ env: { jest: true } }).map((config) => ({
        ...config,
        files: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.spec.js', '**/*.spec.jsx'],
      })),
      { ignores: ['.next/**/*'] },
    ];`
    );

    await update(tree);

    expect(
      tree.read(`packages/my-pkg/eslint.config.js`, 'utf-8')
    ).not.toContain("'@next/next/no-html-link-for-pages': 'off'");
  });
});
