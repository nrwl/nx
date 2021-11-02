import {
  addProjectConfiguration,
  Tree,
  readJson,
  writeJson,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import updateTsConfigsWithEslint from './always-use-project-level-tsconfigs-with-eslint';

describe('Always use project level tsconfigs with eslint', () => {
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
  });

  it('should remove the "project" parserOption from the root ESLint config', async () => {
    writeJson(tree, '.eslintrc.json', {
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
    });

    await updateTsConfigsWithEslint(tree);

    expect(readJson(tree, '.eslintrc.json')).toMatchInlineSnapshot(`
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
    writeJson(tree, 'apps/react-app/.eslintrc.json', projectEslintConfig1);

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
    writeJson(tree, 'libs/workspace-lib/.eslintrc.json', projectEslintConfig2);

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
    writeJson(tree, 'libs/some-lib/.eslintrc.json', projectEslintConfig3);

    await updateTsConfigsWithEslint(tree);

    expect(readJson(tree, 'apps/react-app/.eslintrc.json'))
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
    expect(readJson(tree, 'libs/some-lib/.eslintrc.json')).toEqual(
      projectEslintConfig3
    );
  });

  it('should set Next.js eslint "project" option to include tsconfig.json', async () => {
    addProjectConfiguration(tree, 'next-app', {
      root: 'apps/next-app',
      sourceRoot: 'apps/next-app/src',
      projectType: 'application',
      targets: {
        build: {
          executor: '@nrwl/next:build',
        },
      },
    });
    const projectEslintConfig1 = {
      extends: ['plugin:@nrwl/nx/react', '../../.eslintrc.json'],
      ignorePatterns: ['!**/*'],
      rules: {
        'jsx-a11y/anchor-is-valid': ['off'],
      },
    };
    writeJson(tree, 'apps/next-app/.eslintrc.json', projectEslintConfig1);

    await updateTsConfigsWithEslint(tree);

    expect(readJson(tree, 'apps/next-app/.eslintrc.json'))
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
                "apps/next-app/tsconfig(.*)?.json",
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
  });
});
