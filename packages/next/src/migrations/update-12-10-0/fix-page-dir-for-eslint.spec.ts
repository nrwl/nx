import { readJson, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import { applicationGenerator } from '../../generators/application/application';
import { fixPageDirForEslint } from './fix-page-dir-for-eslint';

describe('Migration: Fix pages directory for ESLint', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();

    await applicationGenerator(tree, {
      style: 'none',
      name: 'demo',
      skipFormat: false,
    });
  });

  it('should fix custom pages path', async () => {
    // Config that isn't configured properly
    tree.write(
      'apps/demo/.eslintrc.json',
      JSON.stringify({
        extends: ['next'],
        overrides: [
          {
            files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
            rules: {
              'existing-rule': 'error',
            },
          },
        ],
      })
    );

    await fixPageDirForEslint(tree);

    const result = readJson(tree, 'apps/demo/.eslintrc.json');
    expect(result.overrides[0].rules).toEqual({
      'existing-rule': 'error',
      '@next/next/no-html-link-for-pages': ['error', 'apps/demo/pages'],
    });
  });

  it('should leave existing no-html-link-for-pages rule if it exists', async () => {
    // Config that isn't configured properly
    tree.write(
      'apps/demo/.eslintrc.json',
      JSON.stringify({
        extends: ['next'],
        overrides: [
          {
            files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
            rules: {
              '@next/next/no-html-link-for-pages': [
                'error',
                'apps/demo/some/other/path',
              ],
            },
          },
        ],
      })
    );

    await fixPageDirForEslint(tree);

    const result = readJson(tree, 'apps/demo/.eslintrc.json');
    expect(result.overrides[0].rules).toEqual({
      '@next/next/no-html-link-for-pages': [
        'error',
        'apps/demo/some/other/path',
      ],
    });
  });

  it('should handle custom overrides configuration', async () => {
    // Config that isn't configured properly
    tree.write(
      'apps/demo/.eslintrc.json',
      JSON.stringify({
        extends: ['next', 'plugin:vue/base'],
        overrides: [
          { files: ['*.vue'], rule: { 'vue/comment-directive': 'error' } },
          {
            files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
            rules: {
              '@next/next/no-html-link-for-pages': [
                'error',
                'apps/demo/some/other/path',
              ],
            },
          },
        ],
      })
    );

    await fixPageDirForEslint(tree);

    const result = readJson(tree, 'apps/demo/.eslintrc.json');
    expect(result.overrides).toEqual([
      { files: ['*.vue'], rule: { 'vue/comment-directive': 'error' } },
      {
        files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
        rules: {
          '@next/next/no-html-link-for-pages': [
            'error',
            'apps/demo/some/other/path',
          ],
        },
      },
    ]);
  });
});
