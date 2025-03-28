import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  addProjectConfiguration,
  readJson,
  readProjectConfiguration,
  Tree,
  updateJson,
} from '@nx/devkit';

import { Linter } from '../utils/linter';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { lintProjectGenerator } from './lint-project';

describe('@nx/eslint:lint-project', () => {
  let tree: Tree;

  const defaultOptions = {
    skipFormat: false,
    addPlugin: true,
  };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'test-lib', {
      root: 'libs/test-lib',
      projectType: 'library',
      targets: {
        test: {
          command: 'echo test',
        },
      },
    });
    addProjectConfiguration(tree, 'buildable-lib', {
      root: 'libs/buildable-lib',
      projectType: 'library',
      targets: {
        build: {
          command: 'echo build',
        },
      },
    });
  });

  describe('Eslint base config named eslint.base.config', () => {
    it('should generate a flat eslint config format based on base config (JS with CJS export)', async () => {
      const originalEslintUseFlatConfigVal = process.env.ESLINT_USE_FLAT_CONFIG;
      process.env.ESLINT_USE_FLAT_CONFIG = 'true';

      // CJS config
      tree.write('eslint.base.config.js', 'module.exports = {};');

      await lintProjectGenerator(tree, {
        ...defaultOptions,
        linter: Linter.EsLint,
        project: 'test-lib',
        setParserOptionsProject: false,
        skipFormat: true,
      });

      expect(tree.read('libs/test-lib/eslint.config.cjs', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const baseConfig = require("../../eslint.base.config.js");

        module.exports = [
            ...baseConfig
        ];
        "
      `);

      process.env.ESLINT_USE_FLAT_CONFIG = originalEslintUseFlatConfigVal;
    });

    it('should generate a flat eslint config format based on base config (JS with MJS export)', async () => {
      const originalEslintUseFlatConfigVal = process.env.ESLINT_USE_FLAT_CONFIG;
      process.env.ESLINT_USE_FLAT_CONFIG = 'true';

      // MJS config
      tree.write('eslint.base.config.js', 'export default {};');

      await lintProjectGenerator(tree, {
        ...defaultOptions,
        linter: Linter.EsLint,
        project: 'test-lib',
        setParserOptionsProject: false,
        skipFormat: true,
      });

      expect(tree.read('libs/test-lib/eslint.config.mjs', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import baseConfig from "../../eslint.base.config.js";

        export default [
            ...baseConfig
        ];
        "
      `);

      process.env.ESLINT_USE_FLAT_CONFIG = originalEslintUseFlatConfigVal;
    });

    it('should generate a flat eslint config format based on base config (mjs)', async () => {
      const originalEslintUseFlatConfigVal = process.env.ESLINT_USE_FLAT_CONFIG;
      process.env.ESLINT_USE_FLAT_CONFIG = 'true';

      // MJS config
      tree.write('eslint.base.config.mjs', 'export default {};');

      await lintProjectGenerator(tree, {
        ...defaultOptions,
        linter: Linter.EsLint,
        project: 'test-lib',
        setParserOptionsProject: false,
        skipFormat: true,
        eslintConfigFormat: 'mjs',
      });

      expect(tree.read('libs/test-lib/eslint.config.mjs', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import baseConfig from "../../eslint.base.config.mjs";

        export default [
            ...baseConfig
        ];
        "
      `);

      process.env.ESLINT_USE_FLAT_CONFIG = originalEslintUseFlatConfigVal;
    });

    it('should generate a flat eslint config format based on base config CJS', async () => {
      const originalEslintUseFlatConfigVal = process.env.ESLINT_USE_FLAT_CONFIG;
      process.env.ESLINT_USE_FLAT_CONFIG = 'true';

      // CJS config
      tree.write('eslint.base.config.cjs', 'module.exports = {};');

      await lintProjectGenerator(tree, {
        ...defaultOptions,
        linter: Linter.EsLint,
        project: 'test-lib',
        setParserOptionsProject: false,
        skipFormat: true,
      });

      expect(tree.read('libs/test-lib/eslint.config.cjs', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const baseConfig = require("../../eslint.base.config.cjs");

        module.exports = [
            ...baseConfig
        ];
        "
      `);

      process.env.ESLINT_USE_FLAT_CONFIG = originalEslintUseFlatConfigVal;
    });
  });

  describe('Eslint base config named eslint.config', () => {
    it('should generate a flat eslint config format based on base config (JS with CJS export)', async () => {
      const originalEslintUseFlatConfigVal = process.env.ESLINT_USE_FLAT_CONFIG;
      process.env.ESLINT_USE_FLAT_CONFIG = 'true';

      // CJS config
      tree.write('eslint.config.js', 'module.exports = {};');

      await lintProjectGenerator(tree, {
        ...defaultOptions,
        linter: Linter.EsLint,
        project: 'test-lib',
        setParserOptionsProject: false,
        skipFormat: true,
      });

      expect(tree.read('libs/test-lib/eslint.config.cjs', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const baseConfig = require("../../eslint.config.js");

        module.exports = [
            ...baseConfig
        ];
        "
      `);

      process.env.ESLINT_USE_FLAT_CONFIG = originalEslintUseFlatConfigVal;
    });

    it('should generate a flat eslint config format based on base config (JS with MJS export)', async () => {
      const originalEslintUseFlatConfigVal = process.env.ESLINT_USE_FLAT_CONFIG;
      process.env.ESLINT_USE_FLAT_CONFIG = 'true';

      // MJS config
      tree.write('eslint.config.js', 'export default {};');

      await lintProjectGenerator(tree, {
        ...defaultOptions,
        linter: Linter.EsLint,
        project: 'test-lib',
        setParserOptionsProject: false,
        skipFormat: true,
      });

      expect(tree.read('libs/test-lib/eslint.config.mjs', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import baseConfig from "../../eslint.config.js";

        export default [
            ...baseConfig
        ];
        "
      `);

      process.env.ESLINT_USE_FLAT_CONFIG = originalEslintUseFlatConfigVal;
    });

    it('should generate a flat eslint config format based on base config (mjs)', async () => {
      const originalEslintUseFlatConfigVal = process.env.ESLINT_USE_FLAT_CONFIG;
      process.env.ESLINT_USE_FLAT_CONFIG = 'true';

      // MJS config
      tree.write('eslint.config.mjs', 'export default {};');

      await lintProjectGenerator(tree, {
        ...defaultOptions,
        linter: Linter.EsLint,
        project: 'test-lib',
        setParserOptionsProject: false,
        skipFormat: true,
        eslintConfigFormat: 'mjs',
      });

      expect(tree.read('libs/test-lib/eslint.config.mjs', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import baseConfig from "../../eslint.config.mjs";

        export default [
            ...baseConfig
        ];
        "
      `);

      process.env.ESLINT_USE_FLAT_CONFIG = originalEslintUseFlatConfigVal;
    });

    it('should generate a flat eslint config format based on base config CJS', async () => {
      const originalEslintUseFlatConfigVal = process.env.ESLINT_USE_FLAT_CONFIG;
      process.env.ESLINT_USE_FLAT_CONFIG = 'true';

      // CJS config
      tree.write('eslint.config.cjs', 'module.exports = {};');

      await lintProjectGenerator(tree, {
        ...defaultOptions,
        linter: Linter.EsLint,
        project: 'test-lib',
        setParserOptionsProject: false,
        skipFormat: true,
      });

      expect(tree.read('libs/test-lib/eslint.config.cjs', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const baseConfig = require("../../eslint.config.cjs");

        module.exports = [
            ...baseConfig
        ];
        "
      `);

      process.env.ESLINT_USE_FLAT_CONFIG = originalEslintUseFlatConfigVal;
    });
  });

  it('should generate a flat eslint base config ESM', async () => {
    const originalEslintUseFlatConfigVal = process.env.ESLINT_USE_FLAT_CONFIG;
    process.env.ESLINT_USE_FLAT_CONFIG = 'true';
    await lintProjectGenerator(tree, {
      ...defaultOptions,
      linter: Linter.EsLint,
      project: 'test-lib',
      setParserOptionsProject: false,
      skipFormat: true,
      eslintConfigFormat: 'mjs',
    });

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
    process.env.ESLINT_USE_FLAT_CONFIG = originalEslintUseFlatConfigVal;
  });

  it('should generate a flat eslint base config CJS', async () => {
    const originalEslintUseFlatConfigVal = process.env.ESLINT_USE_FLAT_CONFIG;
    process.env.ESLINT_USE_FLAT_CONFIG = 'true';
    await lintProjectGenerator(tree, {
      ...defaultOptions,
      linter: Linter.EsLint,
      project: 'test-lib',
      setParserOptionsProject: false,
      skipFormat: true,
      eslintConfigFormat: 'cjs',
    });

    expect(tree.read('eslint.config.cjs', 'utf-8')).toMatchInlineSnapshot(`
      "const nx = require("@nx/eslint-plugin");

      module.exports = [
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
          },
      ];
      "
    `);
    process.env.ESLINT_USE_FLAT_CONFIG = originalEslintUseFlatConfigVal;
  });

  it('should generate a eslint config (legacy)', async () => {
    await lintProjectGenerator(tree, {
      ...defaultOptions,
      linter: Linter.EsLint,
      project: 'test-lib',
      setParserOptionsProject: false,
    });

    expect(tree.read('libs/test-lib/.eslintrc.json', 'utf-8'))
      .toMatchInlineSnapshot(`
      "{
        "extends": ["../../.eslintrc.json"],
        "ignorePatterns": ["!**/*"],
        "overrides": [
          {
            "files": ["*.ts", "*.tsx", "*.js", "*.jsx"],
            "rules": {}
          },
          {
            "files": ["*.ts", "*.tsx"],
            "rules": {}
          },
          {
            "files": ["*.js", "*.jsx"],
            "rules": {}
          }
        ]
      }
      "
    `);
  });

  it('should generate a project config with lintFilePatterns if provided', async () => {
    await lintProjectGenerator(tree, {
      ...defaultOptions,
      linter: Linter.EsLint,
      project: 'test-lib',
      eslintFilePatterns: ['libs/test-lib/src/**/*.ts'],
      setParserOptionsProject: false,
    });

    const projectConfig = readProjectConfiguration(tree, 'test-lib');
    expect(projectConfig.targets.lint).toMatchInlineSnapshot(`
      {
        "command": "eslint libs/test-lib/src/**/*.ts",
      }
    `);
  });

  it('should generate a eslint config for buildable library', async () => {
    await lintProjectGenerator(tree, {
      ...defaultOptions,
      linter: Linter.EsLint,
      project: 'buildable-lib',
      setParserOptionsProject: false,
    });

    expect(tree.read('libs/buildable-lib/.eslintrc.json', 'utf-8'))
      .toMatchInlineSnapshot(`
      "{
        "extends": ["../../.eslintrc.json"],
        "ignorePatterns": ["!**/*"],
        "overrides": [
          {
            "files": ["*.ts", "*.tsx", "*.js", "*.jsx"],
            "rules": {}
          },
          {
            "files": ["*.ts", "*.tsx"],
            "rules": {}
          },
          {
            "files": ["*.js", "*.jsx"],
            "rules": {}
          },
          {
            "files": ["*.json"],
            "parser": "jsonc-eslint-parser",
            "rules": {
              "@nx/dependency-checks": [
                "error",
                {
                  "ignoredFiles": ["{projectRoot}/eslint.config.{js,cjs,mjs}"]
                }
              ]
            }
          }
        ]
      }
      "
    `);
    expect(
      readJson(tree, 'package.json').devDependencies['jsonc-eslint-parser']
    ).toBeDefined();
  });

  it('should generate a project config for buildable lib with lintFilePatterns if provided', async () => {
    await lintProjectGenerator(tree, {
      ...defaultOptions,
      linter: Linter.EsLint,
      project: 'buildable-lib',
      setParserOptionsProject: false,
      eslintFilePatterns: ['libs/test-lib/src/**/*.ts'],
    });

    const projectConfig = readProjectConfiguration(tree, 'buildable-lib');
    expect(projectConfig.targets.lint).toMatchInlineSnapshot(`
      {
        "command": "eslint libs/test-lib/src/**/*.ts libs/buildable-lib/package.json",
      }
    `);
  });

  it('should extend to .eslintrc.js when an .eslintrc.js already exist', async () => {
    tree.write('.eslintrc.js', '{}');

    await lintProjectGenerator(tree, {
      ...defaultOptions,
      linter: Linter.EsLint,
      project: 'test-lib',
      setParserOptionsProject: false,
    });

    expect(tree.read('libs/test-lib/.eslintrc.json', 'utf-8'))
      .toMatchInlineSnapshot(`
      "{
        "extends": ["../../.eslintrc.js"],
        "ignorePatterns": ["!**/*"],
        "overrides": [
          {
            "files": ["*.ts", "*.tsx", "*.js", "*.jsx"],
            "rules": {}
          },
          {
            "files": ["*.ts", "*.tsx"],
            "rules": {}
          },
          {
            "files": ["*.js", "*.jsx"],
            "rules": {}
          }
        ]
      }
      "
    `);
  });

  it('should update nx.json to enable source analysis when using npm.json preset', async () => {
    updateJson(tree, 'nx.json', (json) => {
      // npm preset disables source analysis
      json.extends = 'nx/presets/npm.json';
      return json;
    });

    await lintProjectGenerator(tree, {
      ...defaultOptions,
      linter: Linter.EsLint,
      project: 'buildable-lib',
      setParserOptionsProject: false,
    });

    expect(readJson(tree, 'nx.json').pluginsConfig['@nx/js']).toEqual({
      analyzeSourceFiles: true,
    });
  });

  it('should update nx.json to enable source analysis when it is disabled', async () => {
    updateJson(tree, 'nx.json', (json) => {
      // npm preset disables source analysis
      json.pluginsConfig = {
        '@nx/js': {
          analyzeSourceFiles: false,
        },
      };
      return json;
    });

    await lintProjectGenerator(tree, {
      ...defaultOptions,
      linter: Linter.EsLint,
      project: 'buildable-lib',
      setParserOptionsProject: false,
    });

    expect(readJson(tree, 'nx.json').pluginsConfig['@nx/js']).toEqual({
      analyzeSourceFiles: true,
    });
  });

  it('should extend root config', async () => {
    await lintProjectGenerator(tree, {
      ...defaultOptions,
      linter: Linter.EsLint,
      eslintFilePatterns: ['libs/test-lib/**/*.ts'],
      project: 'test-lib',
      setParserOptionsProject: false,
    });

    const eslintConfig = readJson(tree, 'libs/test-lib/.eslintrc.json');
    expect(eslintConfig.extends).toBeDefined();
  });

  it('should not extend root config if rootProject is set', async () => {
    await lintProjectGenerator(tree, {
      ...defaultOptions,
      linter: Linter.EsLint,
      eslintFilePatterns: ['libs/test-lib/**/*.ts'],
      project: 'test-lib',
      setParserOptionsProject: false,
      rootProject: true,
    });

    const eslintConfig = readJson(tree, 'libs/test-lib/.eslintrc.json');
    expect(eslintConfig.extends).toBeUndefined();
  });

  it('should generate the global eslint config', async () => {
    await lintProjectGenerator(tree, {
      ...defaultOptions,
      linter: Linter.EsLint,
      project: 'test-lib',
    });

    expect(tree.read('.eslintrc.json', 'utf-8')).toMatchInlineSnapshot(`
      "{
        "root": true,
        "ignorePatterns": ["**/*"],
        "plugins": ["@nx"],
        "overrides": [
          {
            "files": ["*.ts", "*.tsx", "*.js", "*.jsx"],
            "rules": {
              "@nx/enforce-module-boundaries": [
                "error",
                {
                  "enforceBuildableLibDependency": true,
                  "allow": [],
                  "depConstraints": [
                    {
                      "sourceTag": "*",
                      "onlyDependOnLibsWithTags": ["*"]
                    }
                  ]
                }
              ]
            }
          },
          {
            "files": ["*.ts", "*.tsx"],
            "extends": ["plugin:@nx/typescript"],
            "rules": {}
          },
          {
            "files": ["*.js", "*.jsx"],
            "extends": ["plugin:@nx/javascript"],
            "rules": {}
          }
        ]
      }
      "
    `);
    expect(tree.read('.eslintignore', 'utf-8')).toMatchInlineSnapshot(`
          "node_modules
          "
        `);
  });

  it('should support generating explicit targets on project config', async () => {
    addProjectConfiguration(tree, 'explicit-lib', {
      root: 'libs/explicit-lib',
      projectType: 'library',
      targets: {},
    });
    addProjectConfiguration(tree, 'inferred-lib', {
      root: 'libs/inferred-lib',
      projectType: 'library',
      targets: {},
    });

    await lintProjectGenerator(tree, {
      ...defaultOptions,
      linter: Linter.EsLint,
      project: 'explicit-lib',
      addExplicitTargets: true,
    });
    await lintProjectGenerator(tree, {
      ...defaultOptions,
      linter: Linter.EsLint,
      project: 'inferred-lib',
      addExplicitTargets: false,
    });

    const explicitCOnfig = readProjectConfiguration(tree, 'explicit-lib');
    expect(explicitCOnfig.targets.lint).toMatchInlineSnapshot(`
      {
        "executor": "@nx/eslint:lint",
      }
    `);
    const inferredConfig = readProjectConfiguration(tree, 'inferred-lib');
    expect(inferredConfig.targets.lint).toBeUndefined();
  });
});
