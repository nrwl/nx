import { Tree } from '@angular-devkit/schematics';
import { readJsonInTree, updateWorkspace } from '@nrwl/workspace';
import { callRule, createEmptyWorkspace } from '@nrwl/workspace/testing';
import { runMigration } from '../../utils/testing';

describe('Always use project level tsconfigs with eslint', () => {
  let tree: Tree;
  beforeEach(async () => {
    tree = Tree.empty();
    tree = createEmptyWorkspace(tree);
    tree = await callRule(
      updateWorkspace((workspace) => {
        workspace.projects.add({
          name: 'react-app',
          root: 'apps/react-app',
          sourceRoot: 'apps/react-app/src',
          projectType: 'application',
          targets: {},
        });
        workspace.projects.add({
          name: 'workspace-lib',
          root: 'libs/workspace-lib',
          sourceRoot: 'libs/workspace-lib/src',
          projectType: 'library',
          targets: {},
        });
        workspace.projects.add({
          name: 'some-lib',
          root: 'libs/some-lib',
          sourceRoot: 'libs/some-lib/src',
          projectType: 'library',
          targets: {},
        });
      }),
      tree
    );
  });

  it('should remove the "project" parserOption from the root ESLint config', async () => {
    const rootEslintConfig = {
      root: true,
      ignorePatterns: ['**/*'],
      plugins: ['@nrwl/nx'],
      overrides: [
        {
          files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
          parserOptions: { project: './tsconfig.*?.json' },
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
    };

    tree.create('.eslintrc.json', JSON.stringify(rootEslintConfig));

    const result = await runMigration(
      'always-use-project-level-tsconfigs-with-eslint',
      {},
      tree
    );

    expect(readJsonInTree(result, '.eslintrc.json')).toMatchInlineSnapshot(`
      Object {
        "ignorePatterns": Array [
          "**/*",
        ],
        "overrides": Array [
          Object {
            "files": Array [
              "*.ts",
              "*.tsx",
              "*.js",
              "*.jsx",
            ],
            "rules": Object {
              "@nrwl/nx/enforce-module-boundaries": Array [
                "error",
                Object {
                  "allow": Array [],
                  "depConstraints": Array [
                    Object {
                      "onlyDependOnLibsWithTags": Array [
                        "*",
                      ],
                      "sourceTag": "*",
                    },
                  ],
                  "enforceBuildableLibDependency": true,
                },
              ],
            },
          },
          Object {
            "extends": Array [
              "plugin:@nrwl/nx/typescript",
            ],
            "files": Array [
              "*.ts",
              "*.tsx",
            ],
            "rules": Object {},
          },
          Object {
            "extends": Array [
              "plugin:@nrwl/nx/javascript",
            ],
            "files": Array [
              "*.js",
              "*.jsx",
            ],
            "rules": Object {},
          },
        ],
        "plugins": Array [
          "@nrwl/nx",
        ],
        "root": true,
      }
    `);
  });

  it('should set the "project" parserOption within all project ESLint configs, if not already set', async () => {
    // No overrides set at all
    const projectEslintConfig1 = {
      extends: ['plugin:@nrwl/nx/react', '../../.eslintrc.json'],
      ignorePatterns: ['!**/*'],
      rules: {
        'jsx-a11y/anchor-is-valid': ['off'],
      },
    };
    tree.create(
      'apps/react-app/.eslintrc.json',
      JSON.stringify(projectEslintConfig1)
    );

    // Has overrides array, but no parserOptions.project anywhere - add it for them
    const projectEslintConfig2 = {
      extends: '../../../.eslintrc.json',
      ignorePatterns: ['!**/*'],
      overrides: [
        {
          files: ['*.js'],
          rules: {
            'some-custom-override-rule': 'error',
          },
        },
      ],
    };
    tree.create(
      'libs/workspace-lib/.eslintrc.json',
      JSON.stringify(projectEslintConfig2)
    );

    // parserOptions.project already set manually by the user at some point, leave it alone
    const projectEslintConfig3 = {
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
    tree.create(
      'libs/some-lib/.eslintrc.json',
      JSON.stringify(projectEslintConfig3)
    );

    const result = await runMigration(
      'always-use-project-level-tsconfigs-with-eslint',
      {},
      tree
    );

    expect(readJsonInTree(result, 'apps/react-app/.eslintrc.json'))
      .toMatchInlineSnapshot(`
      Object {
        "extends": Array [
          "plugin:@nrwl/nx/react",
          "../../.eslintrc.json",
        ],
        "ignorePatterns": Array [
          "!**/*",
        ],
        "overrides": Array [
          Object {
            "files": Array [
              "*.ts",
              "*.tsx",
              "*.js",
              "*.jsx",
            ],
            "parserOptions": Object {
              "project": Array [
                "apps/react-app/tsconfig.*?.json",
              ],
            },
            "rules": Object {},
          },
          Object {
            "files": Array [
              "*.ts",
              "*.tsx",
            ],
            "rules": Object {},
          },
          Object {
            "files": Array [
              "*.js",
              "*.jsx",
            ],
            "rules": Object {},
          },
        ],
        "rules": Object {
          "jsx-a11y/anchor-is-valid": Array [
            "off",
          ],
        },
      }
    `);

    expect(readJsonInTree(result, 'libs/workspace-lib/.eslintrc.json'))
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
              "*.js",
              "*.jsx",
            ],
            "parserOptions": Object {
              "project": Array [
                "libs/workspace-lib/tsconfig.*?.json",
              ],
            },
            "rules": Object {},
          },
          Object {
            "files": Array [
              "*.js",
            ],
            "rules": Object {
              "some-custom-override-rule": "error",
            },
          },
        ],
      }
    `);

    // No change
    expect(readJsonInTree(result, 'libs/some-lib/.eslintrc.json')).toEqual(
      projectEslintConfig3
    );
  });
});
