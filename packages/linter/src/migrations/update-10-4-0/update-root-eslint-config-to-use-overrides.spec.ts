import { Tree } from '@angular-devkit/schematics';
import { readJsonInTree } from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { runMigration } from '../../utils/testing';
import { serializeJson } from '@nrwl/devkit';

describe('Update root ESLint config to use overrides', () => {
  let tree: Tree;
  beforeEach(async () => {
    tree = Tree.empty();
    tree = createEmptyWorkspace(tree);
  });

  const testCases = [
    {
      // Most recent root ESLint config (before this change) with no modifications
      input: {
        root: true,
        ignorePatterns: ['**/*'],
        plugins: ['@nrwl/nx'],
        extends: ['plugin:@nrwl/nx/typescript'],
        rules: {
          '@nrwl/nx/enforce-module-boundaries': [
            'error',
            {
              enforceBuildableLibDependency: true,
              allow: [],
              depConstraints: [
                { sourceTag: '*', onlyDependOnLibsWithTags: ['*'] },
              ],
            },
          ],
        },
      },
      expected: {
        root: true,
        ignorePatterns: ['**/*'],
        plugins: ['@nrwl/nx'],
        overrides: [
          {
            files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
            rules: {
              '@nrwl/nx/enforce-module-boundaries': [
                'error',
                {
                  enforceBuildableLibDependency: true,
                  allow: [],
                  depConstraints: [
                    { sourceTag: '*', onlyDependOnLibsWithTags: ['*'] },
                  ],
                },
              ],
            },
          },
          {
            files: ['*.ts', '*.tsx'],
            extends: ['plugin:@nrwl/nx/typescript'],
            parserOptions: { project: './tsconfig.*?.json' },
            rules: {},
          },
          {
            files: ['*.js', '*.jsx'],
            extends: ['plugin:@nrwl/nx/javascript'],
            rules: {},
          },
        ],
      },
    },

    {
      // Example using custom overrides already (should be a noop)
      input: {
        root: true,
        ignorePatterns: ['**/*'],
        plugins: ['@nrwl/nx'],
        extends: ['plugin:@nrwl/nx/typescript'],
        overrides: [
          {
            files: ['*.ts'],
            rules: {
              foo: 'error',
            },
          },
        ],
      },
      expected: {
        root: true,
        ignorePatterns: ['**/*'],
        plugins: ['@nrwl/nx'],
        extends: ['plugin:@nrwl/nx/typescript'],
        overrides: [
          {
            files: ['*.ts'],
            rules: {
              foo: 'error',
            },
          },
        ],
      },
    },

    {
      // Example using custom rules and plugins at the top-level
      input: {
        root: true,
        ignorePatterns: ['**/*'],
        plugins: ['@nrwl/nx', 'plugin-a', 'plugin-b'],
        extends: ['plugin:@nrwl/nx/typescript'],
        rules: {
          bar: 'warn',
          'plugin-a/qux': ['error', { someConfig: true }],
          'plugin-b/baz': 'off',
        },
      },
      expected: {
        root: true,
        ignorePatterns: ['**/*'],
        plugins: ['@nrwl/nx'],
        overrides: [
          {
            files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
            plugins: ['plugin-a', 'plugin-b'],
            rules: {
              bar: 'warn',
              'plugin-a/qux': ['error', { someConfig: true }],
              'plugin-b/baz': 'off',
            },
          },
          {
            files: ['*.ts', '*.tsx'],
            extends: ['plugin:@nrwl/nx/typescript'],
            parserOptions: { project: './tsconfig.*?.json' },
            rules: {},
          },
          {
            files: ['*.js', '*.jsx'],
            extends: ['plugin:@nrwl/nx/javascript'],
            rules: {},
          },
        ],
      },
    },

    {
      // Example using other custom config at the top-level
      input: {
        root: true,
        ignorePatterns: ['**/*'],
        plugins: ['@nrwl/nx'],
        settings: {
          foo: 'bar',
        },
        env: {
          browser: true,
        },
        parser: 'some-custom-parser-value',
        parserOptions: {
          custom: 'option',
        },
        extends: ['plugin:@nrwl/nx/typescript', 'custom-extends-config'],
      },
      expected: {
        root: true,
        ignorePatterns: ['**/*'],
        plugins: ['@nrwl/nx'],
        overrides: [
          {
            files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
            extends: ['custom-extends-config'],
            env: {
              browser: true,
            },
            settings: {
              foo: 'bar',
            },
            parser: 'some-custom-parser-value',
            parserOptions: {
              custom: 'option',
            },
            rules: {},
          },
          {
            files: ['*.ts', '*.tsx'],
            extends: ['plugin:@nrwl/nx/typescript'],
            parserOptions: { project: './tsconfig.*?.json' },
            rules: {},
          },
          {
            files: ['*.js', '*.jsx'],
            extends: ['plugin:@nrwl/nx/javascript'],
            rules: {},
          },
        ],
      },
    },
  ];

  testCases.forEach((tc, i) => {
    it(`should update the existing root .eslintrc.json file to use overrides, CASE ${i}`, async () => {
      tree.create('.eslintrc.json', serializeJson(tc.input));

      const result = await runMigration(
        'update-root-eslint-config-to-use-overrides',
        {},
        tree
      );
      expect(readJsonInTree(result, '.eslintrc.json')).toEqual(tc.expected);
    });
  });
});
