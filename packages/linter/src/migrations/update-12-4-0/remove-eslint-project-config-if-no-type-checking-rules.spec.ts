import {
  addProjectConfiguration,
  readJson,
  Tree,
  writeJson,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import removeESLintProjectConfigIfNoTypeCheckingRules from './remove-eslint-project-config-if-no-type-checking-rules';
import type { Linter } from 'eslint';
const KNOWN_RULE_REQUIRING_TYPE_CHECKING = '@typescript-eslint/await-thenable';

describe('Remove ESLint parserOptions.project config if no rules requiring type-checking are in use', () => {
  let tree: Tree;
  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'react-app', {
      root: 'apps/react-app',
      sourceRoot: 'apps/react-app/src',
      projectType: 'application',
      targets: {},
    });
    addProjectConfiguration(tree, 'workspace-lib', {
      root: 'libs/workspace-lib',
      sourceRoot: 'libs/workspace-lib/src',
      projectType: 'library',
      targets: {},
    });
    addProjectConfiguration(tree, 'some-lib', {
      root: 'libs/some-lib',
      sourceRoot: 'libs/some-lib/src',
      projectType: 'library',
      targets: {},
    });
    addProjectConfiguration(tree, 'another-lib', {
      root: 'libs/another-lib',
      sourceRoot: 'libs/another-lib/src',
      projectType: 'library',
      targets: {},
    });
  });

  it('should not update any configs if the root .eslintrc.json contains at least one rule requiring type-checking', async () => {
    const rootEslintConfig = {
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
          rules: {
            [KNOWN_RULE_REQUIRING_TYPE_CHECKING]: 'error',
          },
        },
        {
          files: ['*.js', '*.jsx'],
          extends: ['plugin:@nrwl/nx/javascript'],
          rules: {},
        },
      ],
    };
    writeJson(tree, '.eslintrc.json', rootEslintConfig);

    const projectEslintConfig1 = {
      extends: '../../../.eslintrc.json',
      ignorePatterns: ['!**/*'],
      overrides: [
        {
          files: ['*.ts', '*.tsx'],
          parserOptions: {
            project: 'some-path-to-tsconfig.json',
          },
          rules: {},
        },
      ],
    };
    writeJson(tree, 'apps/react-app/.eslintrc.json', projectEslintConfig1);

    const projectEslintConfig2 = {
      extends: '../../../.eslintrc.json',
      ignorePatterns: ['!**/*'],
      overrides: [
        {
          files: ['*.ts', '*.tsx'],
          parserOptions: {
            project: 'some-path-to-tsconfig.json',
          },
          rules: {},
        },
      ],
    };
    writeJson(tree, 'libs/workspace-lib/.eslintrc.json', projectEslintConfig2);

    await removeESLintProjectConfigIfNoTypeCheckingRules(tree);

    // No change
    expect(readJson(tree, 'apps/react-app/.eslintrc.json')).toEqual(
      projectEslintConfig1
    );

    // No change
    expect(readJson(tree, 'libs/workspace-lib/.eslintrc.json')).toEqual(
      projectEslintConfig1
    );
  });

  it('should remove the parserOptions.project from any project .eslintrc.json files that do not contain any rules requiring type-checking', async () => {
    // Root doesn't contain any rules requiring type-checking
    const rootEslintConfig = {
      root: true,
      ignorePatterns: ['**/*'],
      plugins: ['@nrwl/nx'],
      overrides: [],
    };
    writeJson(tree, '.eslintrc.json', rootEslintConfig);

    const projectEslintConfig1: Linter.Config = {
      extends: '../../../.eslintrc.json',
      ignorePatterns: ['!**/*'],
      overrides: [
        {
          files: ['*.ts', '*.tsx'],
          parserOptions: {
            project: 'some-path-to-tsconfig.json',
          },
          rules: {
            [KNOWN_RULE_REQUIRING_TYPE_CHECKING]: 'error',
          },
        },
      ],
    };
    writeJson(tree, 'apps/react-app/.eslintrc.json', projectEslintConfig1);

    const projectEslintConfig2: Linter.Config = {
      extends: '../../../.eslintrc.json',
      ignorePatterns: ['!**/*'],
      overrides: [
        {
          files: ['*.ts', '*.tsx'],
          parserOptions: {
            project: 'some-path-to-tsconfig.json',
          },
          rules: {
            // No rules requiring type-checking
          },
        },
      ],
    };
    writeJson(tree, 'libs/workspace-lib/.eslintrc.json', projectEslintConfig2);

    const projectEslintConfig3: Linter.Config = {
      extends: '../../../.eslintrc.json',
      ignorePatterns: ['!**/*'],
      overrides: [
        {
          files: ['*.ts', '*.tsx'],
          parserOptions: {
            project: 'some-path-to-tsconfig.json',
          },
          rules: {
            [KNOWN_RULE_REQUIRING_TYPE_CHECKING]: 'off',
          },
        },
      ],
    };
    writeJson(tree, 'libs/another-lib/.eslintrc.json', projectEslintConfig3);

    await removeESLintProjectConfigIfNoTypeCheckingRules(tree);

    // No change - uses rule requiring type-checking
    expect(readJson(tree, 'apps/react-app/.eslintrc.json')).toEqual(
      projectEslintConfig1
    );

    // Updated - no more parserOptions.project
    expect(readJson(tree, 'libs/workspace-lib/.eslintrc.json'))
      .toMatchInlineSnapshot(`
      Object {
        "extends": "../../../.eslintrc.json",
        "ignorePatterns": Array [
          "!**/*",
        ],
        "overrides": Array [
          Object {
            "files": Array [
              "*.ts",
              "*.tsx",
            ],
            "rules": Object {},
          },
        ],
      }
    `);

    // Updated - no more parserOptions.project
    expect(readJson(tree, 'libs/another-lib/.eslintrc.json'))
      .toMatchInlineSnapshot(`
      Object {
        "extends": "../../../.eslintrc.json",
        "ignorePatterns": Array [
          "!**/*",
        ],
        "overrides": Array [
          Object {
            "files": Array [
              "*.ts",
              "*.tsx",
            ],
            "rules": Object {
              "@typescript-eslint/await-thenable": "off",
            },
          },
        ],
      }
    `);
  });

  it('should not error if .eslintrc.json does not exist', async () => {
    await removeESLintProjectConfigIfNoTypeCheckingRules(tree);
  });
});
