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
  let envBackup: string | undefined;
  const appProjectName = 'ng-app1';
  const appProjectRoot = `apps/${appProjectName}`;

  beforeEach(() => {
    envBackup = process.env.ESLINT_USE_FLAT_CONFIG;
    delete process.env.ESLINT_USE_FLAT_CONFIG;
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    addProjectConfiguration(tree, appProjectName, {
      root: appProjectRoot,
      prefix: 'myOrg',
      projectType: 'application',
      targets: {},
    } as ProjectConfiguration);
  });

  afterEach(() => {
    if (envBackup === undefined) {
      delete process.env.ESLINT_USE_FLAT_CONFIG;
    } else {
      process.env.ESLINT_USE_FLAT_CONFIG = envBackup;
    }
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

  it('should add the Angular specific EsLint devDependencies (eslintrc)', async () => {
    process.env.ESLINT_USE_FLAT_CONFIG = 'false';
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
    await addLintingGenerator(tree, {
      prefix: 'myOrg',
      projectName: appProjectName,
      projectRoot: appProjectRoot,
      skipFormat: true,
    });

    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies['@typescript-eslint/utils']).toBe('^8.58.0');
  });

  it('should correctly generate the .eslintrc.json file', async () => {
    process.env.ESLINT_USE_FLAT_CONFIG = 'false';
    await addLintingGenerator(tree, {
      prefix: 'myOrg',
      projectName: appProjectName,
      projectRoot: appProjectRoot,
      skipFormat: true,
    });

    const eslintConfig = readJson(tree, `${appProjectRoot}/.eslintrc.json`);
    expect(eslintConfig).toMatchSnapshot();
  });

  it('should set parserOptions.project in the .eslintrc.json file when typed linting is enabled', async () => {
    process.env.ESLINT_USE_FLAT_CONFIG = 'false';
    await addLintingGenerator(tree, {
      prefix: 'myOrg',
      projectName: appProjectName,
      projectRoot: appProjectRoot,
      skipFormat: true,
      enableTypedLinting: true,
    });

    const eslintConfig = readJson(tree, `${appProjectRoot}/.eslintrc.json`);
    const tsOverride = eslintConfig.overrides.find((o) =>
      o.files.includes('*.ts')
    );
    expect(tsOverride.parserOptions).toEqual({
      project: [`${appProjectRoot}/tsconfig.*?.json`],
    });
    expect(
      tree.read(`${appProjectRoot}/.eslintrc.json`, 'utf-8')
    ).not.toContain('projectService');
  });

  it('should carry over typed linting from an existing YAML config', async () => {
    process.env.ESLINT_USE_FLAT_CONFIG = 'false';
    // `findEslintFile` prefers `.eslintrc.yaml` over `.eslintrc.json`, so the
    // carry-over check reads the YAML while the overrides are rewritten into the
    // JSON that `lintProjectGenerator` creates.
    tree.write(
      `${appProjectRoot}/.eslintrc.yaml`,
      `overrides:\n  - files: ['*.ts']\n    parserOptions:\n      project: ['${appProjectRoot}/tsconfig.*?.json']\n`
    );

    await addLintingGenerator(tree, {
      prefix: 'myOrg',
      projectName: appProjectName,
      projectRoot: appProjectRoot,
      skipFormat: true,
    });

    const eslintConfig = readJson(tree, `${appProjectRoot}/.eslintrc.json`);
    const tsOverride = eslintConfig.overrides.find((o) =>
      o.files.includes('*.ts')
    );
    expect(tsOverride.parserOptions).toEqual({
      project: [`${appProjectRoot}/tsconfig.*?.json`],
    });
  });

  it('should not add parserOptions.project when the existing config runs the project service', async () => {
    // The project service needs no glob and typescript-eslint throws when one
    // sits next to it, so there is nothing to carry over here.
    process.env.ESLINT_USE_FLAT_CONFIG = 'false';
    tree.write(
      `${appProjectRoot}/.eslintrc.yaml`,
      `overrides:\n  - files: ['*.ts']\n    parserOptions:\n      projectService: true\n`
    );

    await addLintingGenerator(tree, {
      prefix: 'myOrg',
      projectName: appProjectName,
      projectRoot: appProjectRoot,
      skipFormat: true,
    });

    const eslintConfig = readJson(tree, `${appProjectRoot}/.eslintrc.json`);
    const tsOverride = eslintConfig.overrides.find((o) =>
      o.files.includes('*.ts')
    );
    expect(tsOverride.parserOptions).toBeUndefined();
  });

  it('should not carry over parserOptions.project when the project service is also on', async () => {
    // A top-level `parserOptions` survives the override rewrite, so re-emitting
    // the glob below it would leave the project service and a `project` in
    // effect together, which typescript-eslint rejects.
    process.env.ESLINT_USE_FLAT_CONFIG = 'false';
    tree.write(
      `${appProjectRoot}/.eslintrc.yaml`,
      `parserOptions:\n  projectService: true\noverrides:\n  - files: ['*.ts']\n    parserOptions:\n      project: ['${appProjectRoot}/tsconfig.*?.json']\n`
    );

    await addLintingGenerator(tree, {
      prefix: 'myOrg',
      projectName: appProjectName,
      projectRoot: appProjectRoot,
      skipFormat: true,
    });

    const eslintConfig = readJson(tree, `${appProjectRoot}/.eslintrc.json`);
    const tsOverride = eslintConfig.overrides.find((o) =>
      o.files.includes('*.ts')
    );
    expect(tsOverride.parserOptions).toBeUndefined();
  });

  it('should not set parserOptions in the .eslintrc.json file when typed linting is disabled', async () => {
    process.env.ESLINT_USE_FLAT_CONFIG = 'false';
    await addLintingGenerator(tree, {
      prefix: 'myOrg',
      projectName: appProjectName,
      projectRoot: appProjectRoot,
      skipFormat: true,
    });

    const eslintConfig = readJson(tree, `${appProjectRoot}/.eslintrc.json`);
    const tsOverride = eslintConfig.overrides.find((o) =>
      o.files.includes('*.ts')
    );
    expect(tsOverride.parserOptions).toBeUndefined();
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
          ...nx.configs["flat/angular"],
          ...nx.configs["flat/angular-template"],
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
                              "{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}"
                          ]
                      }
                  ]
              },
              languageOptions: {
                  parser: await import("jsonc-eslint-parser")
              }
          },
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
                  ]
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
                  "**/dist",
                  "**/out-tsc"
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
                              "^.*/eslint(\\\\.base)?\\\\.config\\\\.[cm]?[jt]s$"
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
  });

  it('should correctly generate the .eslintrc.json file for a buildable library', async () => {
    process.env.ESLINT_USE_FLAT_CONFIG = 'false';
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
              ]
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
