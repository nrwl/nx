import 'nx/src/internal-testing-utils/mock-project-graph';
import {
  ProjectConfiguration,
  Tree,
  addProjectConfiguration,
  readJson,
  updateJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import * as linter from '@nx/eslint';
import { addLintingGenerator } from './add-linting';

describe('addLinting generator', () => {
  let tree: Tree;
  const appProjectName = 'ng-app1';
  const appProjectRoot = `apps/${appProjectName}`;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    addProjectConfiguration(tree, appProjectName, {
      root: appProjectRoot,
      prefix: 'myOrg',
      projectType: 'application',
      targets: {},
    } as ProjectConfiguration);
  });

  it('should invoke the lintProjectGenerator', async () => {
    jest.spyOn(linter, 'lintProjectGenerator');

    await addLintingGenerator(tree, {
      prefix: 'myOrg',
      projectName: appProjectName,
      projectRoot: appProjectRoot,
      skipFormat: true,
    });

    expect(linter.lintProjectGenerator).toHaveBeenCalled();
  });

  it('should add the Angular specific EsLint devDependencies', async () => {
    await addLintingGenerator(tree, {
      prefix: 'myOrg',
      projectName: appProjectName,
      projectRoot: appProjectRoot,
      skipFormat: true,
    });

    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies['@angular-eslint/eslint-plugin']).toBeDefined();
    expect(
      devDependencies['@angular-eslint/eslint-plugin-template']
    ).toBeDefined();
    expect(devDependencies['@angular-eslint/template-parser']).toBeDefined();
  });

  it('should use flat config and install correct dependencies when using it', async () => {
    process.env.ESLINT_USE_FLAT_CONFIG = 'true';
    await addLintingGenerator(tree, {
      prefix: 'myOrg',
      projectName: appProjectName,
      projectRoot: appProjectRoot,
      skipFormat: true,
    });

    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies['@typescript-eslint/utils']).toMatchInlineSnapshot(
      `"^8.29.0"`
    );
    delete process.env.ESLINT_USE_FLAT_CONFIG;
  });

  it('should correctly generate the .eslintrc.json file', async () => {
    await addLintingGenerator(tree, {
      prefix: 'myOrg',
      projectName: appProjectName,
      projectRoot: appProjectRoot,
      skipFormat: true,
    });

    const eslintConfig = readJson(tree, `${appProjectRoot}/.eslintrc.json`);
    expect(eslintConfig).toMatchSnapshot();
  });

  it('should not touch the package.json when run with `--skipPackageJson`', async () => {
    let initialPackageJson;
    updateJson(tree, 'package.json', (json) => {
      json.dependencies = {};
      json.devDependencies = {};
      initialPackageJson = json;

      return json;
    });

    await addLintingGenerator(tree, {
      prefix: 'myOrg',
      projectName: appProjectName,
      projectRoot: appProjectRoot,
      skipFormat: true,
      skipPackageJson: true,
    });

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson).toEqual(initialPackageJson);
  });

  it('should correctly generate the eslint.config.mjs file for a buildable library', async () => {
    process.env.ESLINT_USE_FLAT_CONFIG = 'true';

    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      projectType: 'library',
      targets: { build: {} },
    });

    await addLintingGenerator(tree, {
      prefix: 'myOrg',
      projectName: 'lib1',
      projectRoot: 'libs/lib1',
      skipFormat: true,
    });

    expect(tree.read('libs/lib1/eslint.config.mjs', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import nx from "@nx/eslint-plugin";
      import baseConfig from "../../eslint.config.mjs";

      export default [
          ...baseConfig,
          {
              files: [
                  "**/*.json"
              ],
              rules: {
                  "@nx/dependency-checks": [
                      "error",
                      {
                          ignoredFiles: [
                              "{projectRoot}/eslint.config.{js,cjs,mjs}"
                          ]
                      }
                  ]
              },
              languageOptions: {
                  parser: await import("jsonc-eslint-parser")
              }
          },
          ...nx.configs["flat/angular"],
          ...nx.configs["flat/angular-template"],
          {
              files: [
                  "**/*.ts"
              ],
              rules: {
                  "@angular-eslint/directive-selector": [
                      "error",
                      {
                          type: "attribute",
                          prefix: "myOrg",
                          style: "camelCase"
                      }
                  ],
                  "@angular-eslint/component-selector": [
                      "error",
                      {
                          type: "element",
                          prefix: "my-org",
                          style: "kebab-case"
                      }
                  ],
                  "@angular-eslint/component-class-suffix": "off",
                  "@angular-eslint/directive-class-suffix": "off"
              }
          },
          {
              files: [
                  "**/*.html"
              ],
              // Override or add rules here
              rules: {}
          }
      ];
      "
    `);
    expect(tree.read('eslint.config.mjs', 'utf-8')).toMatchInlineSnapshot(`
      "import nx from "@nx/eslint-plugin";

      export default [
          ...nx.configs["flat/base"],
          ...nx.configs["flat/typescript"],
          ...nx.configs["flat/javascript"],
          {
              ignores: [
                  "**/dist"
              ]
          },
          {
              files: [
                  "**/*.ts",
                  "**/*.tsx",
                  "**/*.js",
                  "**/*.jsx"
              ],
              rules: {
                  "@nx/enforce-module-boundaries": [
                      "error",
                      {
                          enforceBuildableLibDependency: true,
                          allow: [
                              "^.*/eslint(\\\\.base)?\\\\.config\\\\.[cm]?js$"
                          ],
                          depConstraints: [
                              {
                                  sourceTag: "*",
                                  onlyDependOnLibsWithTags: [
                                      "*"
                                  ]
                              }
                          ]
                      }
                  ]
              }
          },
          {
              files: [
                  "**/*.ts",
                  "**/*.tsx",
                  "**/*.cts",
                  "**/*.mts",
                  "**/*.js",
                  "**/*.jsx",
                  "**/*.cjs",
                  "**/*.mjs"
              ],
              // Override or add rules here
              rules: {}
          }
      ];
      "
    `);

    delete process.env.ESLINT_USE_FLAT_CONFIG;
  });

  it('should correctly generate the .eslintrc.json file for a buildable library', async () => {
    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      projectType: 'library',
      targets: { build: {} },
    });

    await addLintingGenerator(tree, {
      prefix: 'myOrg',
      projectName: 'lib1',
      projectRoot: 'libs/lib1',
      skipFormat: true,
    });

    expect(tree.read('libs/lib1/.eslintrc.json', 'utf-8'))
      .toMatchInlineSnapshot(`
      "{
        "extends": [
          "../../.eslintrc.json"
        ],
        "ignorePatterns": [
          "!**/*"
        ],
        "overrides": [
          {
            "files": [
              "*.ts"
            ],
            "extends": [
              "plugin:@nx/angular",
              "plugin:@angular-eslint/template/process-inline-templates"
            ],
            "rules": {
              "@angular-eslint/directive-selector": [
                "error",
                {
                  "type": "attribute",
                  "prefix": "myOrg",
                  "style": "camelCase"
                }
              ],
              "@angular-eslint/component-selector": [
                "error",
                {
                  "type": "element",
                  "prefix": "my-org",
                  "style": "kebab-case"
                }
              ],
              "@angular-eslint/component-class-suffix": "off",
              "@angular-eslint/directive-class-suffix": "off"
            }
          },
          {
            "files": [
              "*.html"
            ],
            "extends": [
              "plugin:@nx/angular-template"
            ],
            "rules": {}
          },
          {
            "files": [
              "*.json"
            ],
            "parser": "jsonc-eslint-parser",
            "rules": {
              "@nx/dependency-checks": [
                "error",
                {
                  "ignoredFiles": [
                    "{projectRoot}/eslint.config.{js,cjs,mjs}"
                  ]
                }
              ]
            }
          }
        ]
      }
      "
    `);
    expect(tree.read('.eslintrc.json', 'utf-8')).toMatchInlineSnapshot(`
      "{
        "root": true,
        "ignorePatterns": [
          "**/*"
        ],
        "plugins": [
          "@nx"
        ],
        "overrides": [
          {
            "files": [
              "*.ts",
              "*.tsx",
              "*.js",
              "*.jsx"
            ],
            "rules": {
              "@nx/enforce-module-boundaries": [
                "error",
                {
                  "enforceBuildableLibDependency": true,
                  "allow": [],
                  "depConstraints": [
                    {
                      "sourceTag": "*",
                      "onlyDependOnLibsWithTags": [
                        "*"
                      ]
                    }
                  ]
                }
              ]
            }
          },
          {
            "files": [
              "*.ts",
              "*.tsx"
            ],
            "extends": [
              "plugin:@nx/typescript"
            ],
            "rules": {}
          },
          {
            "files": [
              "*.js",
              "*.jsx"
            ],
            "extends": [
              "plugin:@nx/javascript"
            ],
            "rules": {}
          }
        ]
      }
      "
    `);
  });
});
