import { Tree } from '@angular-devkit/schematics';
import {
  readWorkspace,
  updateJsonInTree,
  updateWorkspace,
} from '@nrwl/workspace';
import { callRule, createEmptyWorkspace } from '@nrwl/workspace/testing';
import { runMigration } from '../../utils/testing';

describe('Update eslint builder and config for 10.3.0', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = Tree.empty();
    tree = createEmptyWorkspace(tree);
    tree = await callRule(
      updateJsonInTree('.eslintrc', () => ({
        root: true,
        parser: '@typescript-eslint/parser',
        parserOptions: {
          ecmaVersion: 2018,
          sourceType: 'module',
          project: './tsconfig.*?.json',
        },
        ignorePatterns: ['**/*'],
        plugins: ['@typescript-eslint', '@nrwl/nx'],
        extends: [
          'eslint:recommended',
          'plugin:@typescript-eslint/eslint-recommended',
          'plugin:@typescript-eslint/recommended',
          'prettier',
          'prettier/@typescript-eslint',
        ],
        rules: {
          '@typescript-eslint/explicit-member-accessibility': 'off',
          '@typescript-eslint/explicit-function-return-type': 'off',
          '@typescript-eslint/no-parameter-properties': 'off',
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
        overrides: [
          {
            files: ['*.tsx'],
            rules: {
              '@typescript-eslint/no-unused-vars': 'off',
            },
          },
        ],
      })),
      tree
    );
    tree = await callRule(
      updateWorkspace((workspace) => {
        workspace.projects.add({
          name: 'testProject',
          root: 'apps/testProject',
          sourceRoot: 'apps/testProject/src',
          projectType: 'application',
          targets: {
            lint: {
              builder: '@nrwl/linter:lint',
              options: {
                linter: 'eslint',
                tsConfig: [
                  'apps/testProject/tsconfig.app.json',
                  'apps/testProject/tsconfig.spec.json',
                ],
                exclude: ['**/node_modules/**', '!apps/testProject/**/*'],
              },
            },
          },
        });
      }),
      tree
    );
    tree = await callRule(
      updateJsonInTree('apps/testProject/tsconfig.app.json', () => ({
        include: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'],
        files: [
          // We want to include this custom file
          './some-random-relative-file.ts',
          // We don't want to include these files from node_modules
          '../../node_modules/@nrwl/react/typings/cssmodule.d.ts',
          '../../node_modules/@nrwl/react/typings/image.d.ts',
        ],
      })),
      tree
    );
    tree = await callRule(
      updateJsonInTree('apps/testProject/tsconfig.json', () => ({
        include: ['something-ad-hoc/**/*.ts'],
      })),
      tree
    );
    tree = await callRule(
      updateJsonInTree('apps/testProject/tsconfig.spec.json', () => ({
        include: [
          '**/*.spec.ts',
          '**/*.spec.tsx',
          '**/*.spec.js',
          '**/*.spec.jsx',
          '**/*.d.ts',
        ],
      })),
      tree
    );
  });

  it('should migrate the lint builder usage to the new eslint builder', async () => {
    await runMigration('update-eslint-builder-and-config', {}, tree);

    const workspace = readWorkspace(tree);

    expect(workspace.projects['testProject']).toMatchInlineSnapshot(`
      Object {
        "architect": Object {
          "lint": Object {
            "builder": "@nrwl/linter:eslint",
            "options": Object {
              "lintFilePatterns": Array [
                "apps/testProject/**/*.js",
                "apps/testProject/**/*.jsx",
                "apps/testProject/**/*.ts",
                "apps/testProject/**/*.tsx",
                "apps/testProject/some-random-relative-file.ts",
                "apps/testProject/something-ad-hoc/**/*.ts",
                "apps/testProject/**/*.spec.ts",
                "apps/testProject/**/*.spec.tsx",
                "apps/testProject/**/*.spec.js",
                "apps/testProject/**/*.spec.jsx",
                "apps/testProject/**/*.d.ts",
              ],
            },
          },
        },
        "projectType": "application",
        "root": "apps/testProject",
        "sourceRoot": "apps/testProject/src",
      }
    `);
  });
});
