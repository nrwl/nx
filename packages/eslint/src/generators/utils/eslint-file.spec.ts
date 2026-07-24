import { logger, readJson, updateJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  BASE_ESLINT_CONFIG_FILENAMES,
  ESLINT_CONFIG_FILENAMES,
} from '../../utils/config-file';
import {
  addExtendsToLintConfig,
  addIgnoresToLintConfig,
  addOverrideToLintConfig,
  addTypedLintingToFlatConfig,
  findEslintFile,
  inspectTypedLinting,
  isTypedLintingEnabled,
  lintConfigHasOverride,
  replaceOverridesInLintConfig,
} from './eslint-file';

function declareEslintVersion(tree: Tree, version: string) {
  updateJson(tree, 'package.json', (json) => {
    json.devDependencies = { ...json.devDependencies, eslint: version };
    return json;
  });
}

describe('@nx/eslint:lint-file', () => {
  let tree: Tree;
  let envBackup: string | undefined;

  beforeEach(() => {
    envBackup = process.env.ESLINT_USE_FLAT_CONFIG;
    delete process.env.ESLINT_USE_FLAT_CONFIG;
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  afterEach(() => {
    if (envBackup === undefined) {
      delete process.env.ESLINT_USE_FLAT_CONFIG;
    } else {
      process.env.ESLINT_USE_FLAT_CONFIG = envBackup;
    }
  });

  describe('findEslintFile', () => {
    it('should return null when calling findEslintFile when no eslint is found', () => {
      expect(findEslintFile(tree)).toBe(null);
    });

    test.each(ESLINT_CONFIG_FILENAMES)(
      'should return %p when calling findEslintFile',
      (eslintFileName) => {
        tree.write(eslintFileName, '{}');
        expect(findEslintFile(tree)).toBe(eslintFileName);
      }
    );

    test.each(BASE_ESLINT_CONFIG_FILENAMES)(
      'should return base file %p when calling findEslintFile',
      (eslintFileName) => {
        tree.write(eslintFileName, '{}');
        expect(findEslintFile(tree)).toBe(eslintFileName);
      }
    );
  });

  describe('lintConfigHasOverride', () => {
    it('should return true when override exists in eslintrc format', () => {
      tree.write(
        '.eslintrc.json',
        '{"overrides": [{ "files": ["*.ts"], "rules": {} }]}'
      );
      expect(
        lintConfigHasOverride(
          tree,
          '.',
          (o) => {
            return o.files?.includes('*.ts');
          },
          false
        )
      ).toBe(true);
    });

    it('should return false when eslintrc is not in JSON format', () => {
      tree.write(
        '.eslintrc.js',
        'module.exports = {overrides: [{ files: ["*.ts"], rules: {} }]};'
      );
      expect(
        lintConfigHasOverride(
          tree,
          '.',
          (o) => {
            return o.files?.includes('*.ts');
          },
          false
        )
      ).toBe(false);
    });
  });

  describe('addExtendsToLintConfig', () => {
    it('should update string extends property to array', () => {
      process.env.ESLINT_USE_FLAT_CONFIG = 'false';
      tree.write(
        'apps/demo/.eslintrc.json',
        JSON.stringify({
          extends: '../../.eslintrc',
          rules: {},
          overrides: [
            {
              files: ['**/*.ts', '**/*.tsx'],
              rules: {
                '@typescript-eslint/no-unused-vars': 'off',
              },
            },
            {
              files: ['./package.json'],
              parser: 'jsonc-eslint-parser',
              rules: {
                '@nx/dependency-checks': [
                  'error',
                  {
                    buildTargets: ['build'],
                    includeTransitiveDependencies: true,
                    ignoredFiles: [
                      '{projectRoot}/remix.config.js',
                      '{projectRoot}/tailwind.config.js',
                    ],
                    ignoredDependencies: ['saslprep'],
                  },
                ],
              },
            },
          ],
          ignorePatterns: ['!**/*', 'build/**/*'],
        })
      );
      addExtendsToLintConfig(tree, 'apps/demo', 'plugin:playwright/recommend');
      expect(readJson(tree, 'apps/demo/.eslintrc.json').extends).toEqual([
        'plugin:playwright/recommend',
        '../../.eslintrc',
      ]);
    });

    it('should install necessary dependencies', () => {
      declareEslintVersion(tree, '9.0.0');
      tree.write('eslint.config.cjs', 'module.exports = {};');
      tree.write(
        'apps/demo/eslint.config.cjs',
        `const baseConfig = require("../../eslint.config.cjs");

module.exports = [
  ...baseConfig,
  {
    files: [
      "**/*.ts",
      "**/*.tsx",
      "**/*.js",
      "**/*.jsx"
    ],
    rules: {}
  },
];`
      );

      addExtendsToLintConfig(tree, 'apps/demo', {
        name: 'plugin:playwright/recommend',
        needCompatFixup: true,
      });

      expect(readJson(tree, 'package.json').devDependencies)
        .toMatchInlineSnapshot(`
        {
          "@eslint/compat": "^1.1.1",
          "@eslint/eslintrc": "^3.0.0",
          "eslint": "9.0.0",
        }
      `);
    });

    it('should add extends to flat config', () => {
      tree.write('eslint.config.cjs', 'module.exports = {};');
      tree.write(
        'apps/demo/eslint.config.cjs',
        `const baseConfig = require("../../eslint.config.cjs");

module.exports = [
  ...baseConfig,
  {
    files: [
      "**/*.ts",
      "**/*.tsx",
      "**/*.js",
      "**/*.jsx"
    ],
    rules: {}
  },
];`
      );

      addExtendsToLintConfig(tree, 'apps/demo', 'plugin:playwright/recommend');

      expect(tree.read('apps/demo/eslint.config.cjs', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { FlatCompat } = require("@eslint/eslintrc");
        const js = require("@eslint/js");
        const baseConfig = require("../../eslint.config.cjs");

        const compat = new FlatCompat({
          baseDirectory: __dirname,
          recommendedConfig: js.configs.recommended,
        });

        module.exports = [
            ...compat.extends("plugin:playwright/recommend"),

          ...baseConfig,
          {
            files: [
              "**/*.ts",
              "**/*.tsx",
              "**/*.js",
              "**/*.jsx"
            ],
            rules: {}
          },
        ];"
      `);
    });

    it('should add wrapped plugin for compat in extends when using eslint v9', () => {
      declareEslintVersion(tree, '9.0.0');
      tree.write('eslint.config.cjs', 'module.exports = {};');
      tree.write(
        'apps/demo/eslint.config.cjs',
        `const baseConfig = require("../../eslint.config.cjs");

module.exports = [
  ...baseConfig,
  {
    files: [
      "**/*.ts",
      "**/*.tsx",
      "**/*.js",
      "**/*.jsx"
    ],
    rules: {}
  },
];`
      );

      addExtendsToLintConfig(tree, 'apps/demo', {
        name: 'plugin:playwright/recommend',
        needCompatFixup: true,
      });

      expect(tree.read('apps/demo/eslint.config.cjs', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { FlatCompat } = require("@eslint/eslintrc");
        const js = require("@eslint/js");
        const { fixupConfigRules } = require("@eslint/compat");
        const baseConfig = require("../../eslint.config.cjs");

        const compat = new FlatCompat({
          baseDirectory: __dirname,
          recommendedConfig: js.configs.recommended,
        });

        module.exports = [
            ...fixupConfigRules(compat.extends("plugin:playwright/recommend")),

          ...baseConfig,
          {
            files: [
              "**/*.ts",
              "**/*.tsx",
              "**/*.js",
              "**/*.jsx"
            ],
            rules: {}
          },
        ];"
      `);
    });

    it('should handle mixed multiple incompatible and compatible plugins and add them to extends in the specified order when using eslint v9', () => {
      declareEslintVersion(tree, '9.0.0');
      tree.write('eslint.config.cjs', 'module.exports = {};');
      tree.write(
        'apps/demo/eslint.config.cjs',
        `const baseConfig = require("../../eslint.config.cjs");

module.exports = [
  ...baseConfig,
  {
    files: [
      "**/*.ts",
      "**/*.tsx",
      "**/*.js",
      "**/*.jsx"
    ],
    rules: {}
  },
];`
      );

      addExtendsToLintConfig(tree, 'apps/demo', [
        'plugin:some-plugin1',
        'plugin:some-plugin2',
        { name: 'incompatible-plugin1', needCompatFixup: true },
        { name: 'incompatible-plugin2', needCompatFixup: true },
        'plugin:some-plugin3',
        { name: 'incompatible-plugin3', needCompatFixup: true },
      ]);

      expect(tree.read('apps/demo/eslint.config.cjs', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { FlatCompat } = require("@eslint/eslintrc");
        const js = require("@eslint/js");
        const { fixupConfigRules } = require("@eslint/compat");
        const baseConfig = require("../../eslint.config.cjs");

        const compat = new FlatCompat({
          baseDirectory: __dirname,
          recommendedConfig: js.configs.recommended,
        });

        module.exports = [
            ...compat.extends("plugin:some-plugin1", "plugin:some-plugin2"),

            ...fixupConfigRules(compat.extends("incompatible-plugin1")),

            ...fixupConfigRules(compat.extends("incompatible-plugin2")),

            ...compat.extends("plugin:some-plugin3"),

            ...fixupConfigRules(compat.extends("incompatible-plugin3")),

          ...baseConfig,
          {
            files: [
              "**/*.ts",
              "**/*.tsx",
              "**/*.js",
              "**/*.jsx"
            ],
            rules: {}
          },
        ];"
      `);
    });
  });

  describe('replaceOverridesInLintConfig', () => {
    it('should replace overrides when using flat config', () => {
      tree.write('eslint.config.cjs', 'module.exports = {};');
      tree.write(
        'apps/demo/eslint.config.cjs',
        `const baseConfig = require("../../eslint.config.cjs");

module.exports = [
  ...baseConfig,
  {
    files: [
      "**/*.ts",
      "**/*.tsx",
      "**/*.js",
      "**/*.jsx"
    ],
    rules: {}
  },
  {
    files: [
      "**/*.ts",
      "**/*.tsx"
    ],
    rules: {}
  },
  {
    files: [
      "**/*.js",
      "**/*.jsx"
    ],
    rules: {}
  }
];`
      );

      replaceOverridesInLintConfig(tree, 'apps/demo', [
        {
          files: ['*.ts'],
          extends: [
            'plugin:@nx/angular',
            'plugin:@angular-eslint/template/process-inline-templates',
          ],
          rules: {
            '@angular-eslint/directive-selector': [
              'error',
              {
                type: 'attribute',
                prefix: 'myOrg',
                style: 'camelCase',
              },
            ],
            '@angular-eslint/component-selector': [
              'error',
              {
                type: 'element',
                prefix: 'my-org',
                style: 'kebab-case',
              },
            ],
          },
        },
        {
          files: ['*.html'],
          extends: ['plugin:@nx/angular-template'],
          rules: {},
        },
      ]);

      expect(tree.read('apps/demo/eslint.config.cjs', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { FlatCompat } = require("@eslint/eslintrc");
        const js = require("@eslint/js");
        const baseConfig = require("../../eslint.config.cjs");

        const compat = new FlatCompat({
          baseDirectory: __dirname,
          recommendedConfig: js.configs.recommended,
        });

        module.exports = [
          ...baseConfig,
            ...compat.config({
                extends: [
                    "plugin:@nx/angular",
                    "plugin:@angular-eslint/template/process-inline-templates"
                ]
            }).map(config => ({
                ...config,
                files: [
                    "**/*.ts"
                ],
                rules: {
                    ...config.rules,
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
            })),
            ...compat.config({
                extends: [
                    "plugin:@nx/angular-template"
                ]
            }).map(config => ({
                ...config,
                files: [
                    "**/*.html"
                ],
                rules: {
                    ...config.rules
                }
            })),
        ];"
      `);
    });

    it('should import the parser the way a `.cts` config can load it', () => {
      tree.write('eslint.config.cts', 'export default [];');
      tree.write('apps/demo/eslint.config.cts', 'export default [];');

      replaceOverridesInLintConfig(tree, 'apps/demo', [
        { files: ['*.ts'], parser: '@typescript-eslint/parser', rules: {} },
      ]);

      const content = tree.read('apps/demo/eslint.config.cts', 'utf-8');
      expect(content).toContain('require("@typescript-eslint/parser")');
      expect(content).not.toContain('await import(');
    });
  });

  describe('addOverrideToLintConfig', () => {
    it('should import the parser the way a `.cts` config can load it', () => {
      tree.write('eslint.config.cts', 'export default [];');
      tree.write('apps/demo/eslint.config.cts', 'export default [];');

      addOverrideToLintConfig(tree, 'apps/demo', {
        files: ['*.ts'],
        parser: '@typescript-eslint/parser',
        rules: {},
      });

      const content = tree.read('apps/demo/eslint.config.cts', 'utf-8');
      expect(content).toContain('require("@typescript-eslint/parser")');
      expect(content).not.toContain('await import(');
    });
  });

  describe('addIgnoresToLintConfig', () => {
    it('should add a new block with ignores to esm flat config when there is none', () => {
      tree.write('eslint.config.mjs', 'export default [];');

      addIgnoresToLintConfig(tree, '', ['**/some-dir/**/*']);

      expect(tree.read('eslint.config.mjs', 'utf-8')).toMatchInlineSnapshot(`
        "
        export default [
            {
                ignores: [
                    "**/some-dir/**/*"
                ]
            }
        ];
        "
      `);
    });

    it('should update existing block with ignores in esm flat config', () => {
      tree.write(
        'eslint.config.mjs',
        `export default [
  {
    ignores: ["dist"],
  }
];
`
      );

      addIgnoresToLintConfig(tree, '', ['**/some-dir/**/*']);

      expect(tree.read('eslint.config.mjs', 'utf-8')).toMatchInlineSnapshot(`
        "export default [
          {
              "ignores": [
                "dist",
                "**/some-dir/**/*"
              ]
          }
        ];
        "
      `);
    });

    it('should not duplicate existing patterns in a block with ignores in esm flat config', () => {
      tree.write(
        'eslint.config.mjs',
        `export default [
  {
    ignores: ["dist"],
  }
];
`
      );

      addIgnoresToLintConfig(tree, '', ['**/some-dir/**/*', 'dist']);

      expect(tree.read('eslint.config.mjs', 'utf-8')).toMatchInlineSnapshot(`
        "export default [
          {
              "ignores": [
                "dist",
                "**/some-dir/**/*"
              ]
          }
        ];
        "
      `);
    });

    it('should add a new block with ignores to cjs flat config when there is none', () => {
      tree.write('eslint.config.cjs', 'module.exports = [];');

      addIgnoresToLintConfig(tree, '', ['**/some-dir/**/*']);

      expect(tree.read('eslint.config.cjs', 'utf-8')).toMatchInlineSnapshot(`
        "module.exports = [,
            {
                ignores: [
                    "**/some-dir/**/*"
                ]
            }];"
      `);
    });

    it('should update existing block with ignores in cjs flat config', () => {
      tree.write(
        'eslint.config.cjs',
        `module.exports = [
  {
    ignores: ["dist"],
  }
];
`
      );

      addIgnoresToLintConfig(tree, '', ['**/some-dir/**/*']);

      expect(tree.read('eslint.config.cjs', 'utf-8')).toMatchInlineSnapshot(`
        "module.exports = [
          {
              "ignores": [
                "dist",
                "**/some-dir/**/*"
              ]
          }
        ];
        "
      `);
    });

    it('should not duplicate existing patterns in a block with ignores in cjs flat config', () => {
      tree.write(
        'eslint.config.cjs',
        `module.exports = [
  {
    ignores: ["dist"],
  }
];
`
      );

      addIgnoresToLintConfig(tree, '', ['**/some-dir/**/*', 'dist']);

      expect(tree.read('eslint.config.cjs', 'utf-8')).toMatchInlineSnapshot(`
        "module.exports = [
          {
              "ignores": [
                "dist",
                "**/some-dir/**/*"
              ]
          }
        ];
        "
      `);
    });

    it('should add ignore patterns to eslintrc config when there is none', () => {
      tree.write('.eslintrc.json', '{}');

      addIgnoresToLintConfig(tree, '', ['**/some-dir/**/*']);

      expect(readJson(tree, '.eslintrc.json')).toMatchInlineSnapshot(`
        {
          "ignorePatterns": [
            "**/some-dir/**/*",
          ],
        }
      `);
    });

    it('should update existing ignore patterns in eslintrc config', () => {
      tree.write(
        '.eslintrc.json',
        `{
          "ignorePatterns": ["dist"]
        }`
      );

      addIgnoresToLintConfig(tree, '', ['**/some-dir/**/*']);

      expect(readJson(tree, '.eslintrc.json')).toMatchInlineSnapshot(`
        {
          "ignorePatterns": [
            "dist",
            "**/some-dir/**/*",
          ],
        }
      `);
    });

    it('should not duplicate existing ignore patterns in eslintrc config', () => {
      tree.write(
        '.eslintrc.json',
        `{
          "ignorePatterns": ["dist"]
        }`
      );

      addIgnoresToLintConfig(tree, '', ['**/some-dir/**/*', 'dist']);

      expect(readJson(tree, '.eslintrc.json')).toMatchInlineSnapshot(`
        {
          "ignorePatterns": [
            "dist",
            "**/some-dir/**/*",
          ],
        }
      `);
    });
  });

  describe('inspectTypedLinting', () => {
    const NONE = {
      own: false,
      projectService: false,
      project: false,
      uncertain: false,
    };
    const PROJECT_SERVICE = {
      own: true,
      projectService: true,
      project: false,
      uncertain: false,
    };
    const PROJECT = {
      own: true,
      projectService: false,
      project: true,
      uncertain: false,
    };
    // `projectService: false` leaves typed linting off, so neither key reports
    // it; the file still made a choice a caller must not overwrite.
    const OPT_OUT = {
      own: true,
      projectService: false,
      project: false,
      uncertain: false,
    };
    // A local `parserOptions` set through an expression the scan can't read: the
    // caller warns and leaves the config alone rather than risk a conflicting
    // append.
    const UNCERTAIN = {
      own: false,
      projectService: false,
      project: false,
      uncertain: true,
    };

    it('reports nothing when no typed linting is configured', () => {
      expect(inspectTypedLinting('module.exports = [];')).toEqual(NONE);
      expect(
        inspectTypedLinting('{"overrides": [{"files": ["*.ts"]}]}')
      ).toEqual(NONE);
    });

    it('detects the project service', () => {
      expect(
        inspectTypedLinting(
          'export default [{ languageOptions: { parserOptions: { projectService: true } } }];'
        )
      ).toEqual(PROJECT_SERVICE);
    });

    it('reports an explicit projectService: false opt-out as a setting of its own', () => {
      // A user who set `projectService: false` made a deliberate choice; it must
      // be detected so callers don't append a conflicting `projectService: true`.
      expect(
        inspectTypedLinting(
          'export default [{ languageOptions: { parserOptions: { projectService: false } } }];'
        )
      ).toEqual(OPT_OUT);
    });

    it('detects `parserOptions.project` (flat config)', () => {
      expect(
        inspectTypedLinting(
          'export default [{ languageOptions: { parserOptions: { project: ["./tsconfig.json"] } } }];'
        )
      ).toEqual(PROJECT);
    });

    it('detects `parserOptions.project` (JSON)', () => {
      expect(
        inspectTypedLinting(
          '{"overrides": [{"parserOptions": {"project": ["./tsconfig.json"]}}]}'
        )
      ).toEqual(PROJECT);
    });

    it('ignores the word "project" in unrelated contexts', () => {
      expect(
        inspectTypedLinting(
          `// configure parserOptions for your project: false\nexport default [];`
        )
      ).toEqual(NONE);
    });

    it('does not match a `project` key outside the parserOptions block', () => {
      // `parserOptions` here has no `project`; the only `project` array lives in
      // an unrelated `settings` block (e.g. eslint-import-resolver-typescript).
      expect(
        inspectTypedLinting(
          `export default [{ languageOptions: { parserOptions: { ecmaVersion: 2022 } }, settings: { 'import/resolver': { typescript: { project: ['./tsconfig.json'] } } } }];`
        )
      ).toEqual(NONE);
    });

    it('detects `project` past a nested object inside parserOptions', () => {
      expect(
        inspectTypedLinting(
          `export default [{ languageOptions: { parserOptions: { ecmaFeatures: { jsx: true }, project: ['./tsconfig.json'] } } }];`
        )
      ).toEqual(PROJECT);
    });

    it('detects `project` across multiple parserOptions blocks', () => {
      // The first `parserOptions` block has no `project`; the scan must continue
      // to the second block instead of stopping at the first.
      expect(
        inspectTypedLinting(
          `export default [{ languageOptions: { parserOptions: { ecmaVersion: 2022 } } }, { languageOptions: { parserOptions: { project: ['./tsconfig.json'] } } }];`
        )
      ).toEqual(PROJECT);
    });

    it('detects `project` when a string value contains a brace', () => {
      // A `}` inside a string value must not prematurely close the
      // parserOptions block scan and hide a later `project` key.
      expect(
        inspectTypedLinting(
          `export default [{ languageOptions: { parserOptions: { tsconfigRootDir: 'a } b', project: ['./tsconfig.json'] } } }];`
        )
      ).toEqual(PROJECT);
    });

    it('detects `project` when `project` is set to `true`', () => {
      // `project` accepts `boolean | string | string[] | null`, so a boolean is
      // as conflicting with `projectService` as an array is.
      expect(
        inspectTypedLinting(
          'export default [{ languageOptions: { parserOptions: { project: true } } }];'
        )
      ).toEqual(PROJECT);
    });

    it.each(['false', 'null', 'undefined'])(
      'does not count `project: %s`, which leaves typed linting off',
      (value) => {
        // typescript-eslint only builds a program for a truthy `project`, so a
        // falsy one is neither typed linting nor a conflict for `projectService`.
        expect(
          inspectTypedLinting(
            `export default [{ languageOptions: { parserOptions: { project: ${value} } } }];`
          )
        ).toEqual(NONE);
      }
    );

    it('does not read a `parserOptions` that configures a rule (JSON)', () => {
      // A rule's options are not parser options. Reading them would report
      // typed linting the config never enables, and skip a requested block.
      expect(
        inspectTypedLinting(
          '{"rules": {"x/y": ["error", {"parserOptions": {"project": true}}]}}'
        )
      ).toEqual(NONE);
    });

    it('does not read a `parserOptions` that configures a rule (flat config)', () => {
      // Same as the JSON case, on the source path: the scan must not descend
      // into a rule's options and mistake its nested `parserOptions` for the
      // config's own.
      expect(
        inspectTypedLinting(
          `export default [{ rules: { 'x/y': ['error', { parserOptions: { project: true } }] } }];`
        )
      ).toEqual(NONE);
    });

    it('does not count `"project": false` (JSON)', () => {
      expect(
        inspectTypedLinting(
          '{"overrides": [{"parserOptions": {"project": false}}]}'
        )
      ).toEqual(NONE);
    });

    it('counts a variable reference whose name starts with a falsy literal', () => {
      // `falseyPaths` is an identifier, not `false`; we can't evaluate it, so it
      // has to count.
      expect(
        inspectTypedLinting(
          'export default [{ languageOptions: { parserOptions: { project: falseyPaths } } }];'
        )
      ).toEqual(PROJECT);
    });

    it('detects `project` when `project` is a template literal', () => {
      expect(
        inspectTypedLinting(
          'export default [{ languageOptions: { parserOptions: { project: `${import.meta.dirname}/tsconfig.json` } } }];'
        )
      ).toEqual(PROJECT);
    });

    it('detects `project` when `project` is a variable reference', () => {
      expect(
        inspectTypedLinting(
          'export default [{ languageOptions: { parserOptions: { project: tsconfigPaths } } }];'
        )
      ).toEqual(PROJECT);
    });

    it('detects `projectService` when `projectService` is a variable reference', () => {
      expect(
        inspectTypedLinting(
          'export default [{ languageOptions: { parserOptions: { projectService: projectServiceOptions } } }];'
        )
      ).toEqual(PROJECT_SERVICE);
    });

    it('detects `projectService` when `projectService` uses the ES shorthand', () => {
      // The value lives in a variable we can't evaluate, so the shorthand has to
      // count; appending our own block would override the user's choice.
      expect(
        inspectTypedLinting(
          'const projectService = false;\nexport default [{ languageOptions: { parserOptions: { projectService } } }];'
        )
      ).toEqual(PROJECT_SERVICE);
    });

    it('detects `project` when `project` uses the ES shorthand', () => {
      // Appending `projectService: true` next to a truthy `project` makes
      // typescript-eslint fatal on every file it type-checks.
      expect(
        inspectTypedLinting(
          "const project = ['tsconfig.json'];\nexport default [{ languageOptions: { parserOptions: { project } } }];"
        )
      ).toEqual(PROJECT);
    });

    it('detects the ES shorthand when other keys follow it', () => {
      expect(
        inspectTypedLinting(
          'export default [{ languageOptions: { parserOptions: { project, tsconfigRootDir: __dirname } } }];'
        )
      ).toEqual(PROJECT);
    });

    it('does not mistake `projectService` for a shorthand `project`', () => {
      expect(
        inspectTypedLinting(
          'export default [{ languageOptions: { parserOptions: { projectService: false } } }];'
        )
      ).toEqual(OPT_OUT);
    });

    it('detects a setting that follows a regex literal containing `//`', () => {
      // The `//` is regex content, not the start of a comment.
      expect(
        inspectTypedLinting(
          `export default [{ settings: { pattern: /[//]/ }, languageOptions: { parserOptions: { projectService: true } } }];`
        )
      ).toEqual(PROJECT_SERVICE);
    });

    it('ignores a key that only appears in a trailing line comment', () => {
      expect(
        inspectTypedLinting(
          `export default [\n  { rules: {} }, // projectService: true\n];`
        )
      ).toEqual(NONE);
    });

    it('detects a setting in a file that also divides', () => {
      expect(
        inspectTypedLinting(
          `const ratio = width / 2;\nexport default [{ languageOptions: { parserOptions: { projectService: true } } }];`
        )
      ).toEqual(PROJECT_SERVICE);
    });

    it('detects a setting sharing a line with a regex literal containing `//`', () => {
      expect(
        inspectTypedLinting(
          `const isTest = (s) => { return /[//]/.test(s); }, opts = { parserOptions: { projectService: true } };`
        )
      ).toEqual(PROJECT_SERVICE);
    });

    it('does not count the key when it only appears inside a string', () => {
      expect(
        inspectTypedLinting(
          `export default [{ rules: { 'x/y': ['error', { message: 'prefer projectService, always' }] } }];`
        )
      ).toEqual(NONE);
    });

    it('does not count a `project` substring inside a glob value', () => {
      expect(
        inspectTypedLinting(
          `export default [{ languageOptions: { parserOptions: { cacheDir: 'tmp/{eslint,project}' } } }];`
        )
      ).toEqual(NONE);
    });

    it('reads a legacy `.eslintrc` that carries comments', () => {
      expect(
        inspectTypedLinting(
          `{\n  // typed linting\n  "overrides": [{ "parserOptions": { "projectService": true } }],\n}`
        )
      ).toEqual(PROJECT_SERVICE);
    });

    it('reads a legacy YAML config', () => {
      expect(
        inspectTypedLinting(
          `overrides:\n  - files: ['*.ts']\n    parserOptions:\n      project: ['apps/demo/tsconfig.*?.json']\n`
        )
      ).toEqual(PROJECT);
    });

    it('reads `projectService` from a legacy YAML config', () => {
      expect(
        inspectTypedLinting(
          `overrides:\n  - files: ['*.ts']\n    parserOptions:\n      projectService: true\n`
        )
      ).toEqual(PROJECT_SERVICE);
    });

    it('reads a YAML config that carries comments', () => {
      expect(
        inspectTypedLinting(
          `# typed linting\nroot: true\noverrides:\n  - parserOptions:\n      project: './tsconfig.json'\n`
        )
      ).toEqual(PROJECT);
    });

    it('does not count a falsy `project` in a YAML config', () => {
      expect(
        inspectTypedLinting(
          `overrides:\n  - parserOptions:\n      project: null\n`
        )
      ).toEqual(NONE);
    });

    it('prefers the JS parse over YAML for a one-line JS config', () => {
      // `module.exports = {root: true};` is also valid YAML, as a mapping keyed
      // on the whole line, so the JS parse has to win.
      expect(
        inspectTypedLinting(
          `module.exports = {parserOptions: {project: ['./tsconfig.json']}};`
        )
      ).toEqual(PROJECT);
    });

    it('reads a legacy `.eslintrc.js`, whose content is JS rather than JSON', () => {
      expect(
        inspectTypedLinting(
          `module.exports = { overrides: [{ parserOptions: { project: './tsconfig.json' } }] };`
        )
      ).toEqual(PROJECT);
    });

    it('detects a `parserOptions` object referenced under another name', () => {
      expect(
        inspectTypedLinting(
          `const opts = { project: ['tsconfig.json'] };\nexport default [{ languageOptions: { parserOptions: opts } }];`
        )
      ).toEqual(PROJECT);
    });

    it('ignores a `parserOptions` variable the config never references', () => {
      // Declared but unused, so it configures nothing and must not suppress an
      // explicit typed-linting request.
      expect(
        inspectTypedLinting(
          `const parserOptions = { project: './unused.json' };\nexport default [{ rules: {} }];`
        )
      ).toEqual(NONE);
    });

    it('resolves a reference to the declaration in scope, not a shadowed one', () => {
      expect(
        inspectTypedLinting(
          `const opts = { ecmaVersion: 2022 };\nfunction helper() {\n  const opts = { project: './helper.json' };\n  return opts;\n}\nexport default [{ languageOptions: { parserOptions: opts } }];`
        )
      ).toEqual(NONE);
    });

    it('stops at a parameter that shadows an outer object', () => {
      expect(
        inspectTypedLinting(
          `const opts = { project: './unrelated.json' };\nfunction makeConfig(opts) {\n  return { languageOptions: { parserOptions: opts } };\n}\nexport default [makeConfig({ ecmaVersion: 2022 })];`
        )
      ).toEqual(NONE);
    });

    it.each([
      ['a destructured parameter', 'function makeConfig({ opts }) {'],
      [
        'a renamed destructured parameter',
        'function makeConfig({ base: opts }) {',
      ],
    ])('stops at %s', (_name, signature) => {
      expect(
        inspectTypedLinting(
          `const opts = { project: './unrelated.json' };\n${signature}\n  return { languageOptions: { parserOptions: opts } };\n}\nexport default [makeConfig({})];`
        )
      ).toEqual(NONE);
    });

    it('reads through an `as const` on a TypeScript flat config', () => {
      // `eslintFlatConfigFilenames` covers `.ts`/`.cts`/`.mts`, so TS-only syntax
      // reaches here. Missing the opt-out would overwrite it with `true`.
      expect(
        inspectTypedLinting(
          `const opts = { projectService: false } as const;\nexport default [{ languageOptions: { parserOptions: opts } }];`
        )
      ).toEqual(OPT_OUT);
    });

    it('reads a setting brought in by a spread', () => {
      expect(
        inspectTypedLinting(
          `const typed = { projectService: false };\nexport default [{ languageOptions: { parserOptions: { ...typed } } }];`
        )
      ).toEqual(OPT_OUT);
    });

    it('follows an alias chain to the declaring object', () => {
      expect(
        inspectTypedLinting(
          `const typed = { projectService: false };\nconst opts = typed;\nexport default [{ languageOptions: { parserOptions: opts } }];`
        )
      ).toEqual(OPT_OUT);
    });

    it('lets a later spread override an earlier `project`', () => {
      // `{ project: [...], ...typed }` ends up with `project: false` at runtime.
      expect(
        inspectTypedLinting(
          `const typed = { project: false };\nexport default [{ languageOptions: { parserOptions: { project: ['tsconfig.json'], ...typed } } }];`
        )
      ).toEqual(NONE);
    });

    it('counts a spread it cannot resolve, rather than assuming it is empty', () => {
      expect(
        inspectTypedLinting(
          `export default [{ languageOptions: { parserOptions: { ...getBase() } } }];`
        )
      ).toEqual(PROJECT);
    });

    it('terminates on a circular alias', () => {
      // A local `parserOptions` bound to a value the scan can't resolve reads as
      // undecided, not as no typed linting.
      expect(
        inspectTypedLinting(
          `const a = b;\nconst b = a;\nexport default [{ languageOptions: { parserOptions: a } }];`
        )
      ).toEqual(UNCERTAIN);
    });

    it('reads through a `satisfies` expression', () => {
      expect(
        inspectTypedLinting(
          `const opts = { project: ['tsconfig.json'] } satisfies object;\nexport default [{ languageOptions: { parserOptions: opts } }];`
        )
      ).toEqual(PROJECT);
    });

    it('reads through parentheses around an inline object', () => {
      expect(
        inspectTypedLinting(
          `export default [{ languageOptions: { parserOptions: ({ projectService: false }) } }];`
        )
      ).toEqual(OPT_OUT);
    });

    it('stops at a destructured variable', () => {
      expect(
        inspectTypedLinting(
          `const opts = { project: './unrelated.json' };\nfunction makeConfig(input) {\n  const { opts } = input;\n  return { languageOptions: { parserOptions: opts } };\n}\nexport default [makeConfig({})];`
        )
      ).toEqual(NONE);
    });

    it('stops at a `catch` binding', () => {
      expect(
        inspectTypedLinting(
          `const opts = { project: './unrelated.json' };\nfunction makeConfig() {\n  try { risky(); } catch (opts) { return { languageOptions: { parserOptions: opts } }; }\n}\nexport default [makeConfig()];`
        )
      ).toEqual(NONE);
    });

    it('stops at a loop binding', () => {
      expect(
        inspectTypedLinting(
          `const opts = { project: './unrelated.json' };\nfunction makeConfig(all) {\n  for (const opts of all) { return { languageOptions: { parserOptions: opts } }; }\n}\nexport default [makeConfig([])];`
        )
      ).toEqual(NONE);
    });

    it('stops at a nearer binding whose value cannot be read statically', () => {
      expect(
        inspectTypedLinting(
          `const opts = { project: './unrelated.json' };\nfunction makeConfig() {\n  const opts = buildOptions();\n  return { languageOptions: { parserOptions: opts } };\n}\nexport default [makeConfig()];`
        )
      ).toEqual(NONE);
    });

    it('resolves a reference declared in the same function scope', () => {
      expect(
        inspectTypedLinting(
          `export default (() => {\n  const opts = { project: ['tsconfig.json'] };\n  return [{ languageOptions: { parserOptions: opts } }];\n})();`
        )
      ).toEqual(PROJECT);
    });

    it('ignores a `parserOptions` variable local to an unrelated helper', () => {
      expect(
        inspectTypedLinting(
          `function makeOpts() { const parserOptions = { project: './x.json' }; return parserOptions; }\nexport default [{ rules: {} }];`
        )
      ).toEqual(NONE);
    });

    it('detects a `parserOptions` object declared separately and passed by shorthand', () => {
      expect(
        inspectTypedLinting(
          `const parserOptions = { project: ['tsconfig.json'] };\nexport default [{ languageOptions: { parserOptions } }];`
        )
      ).toEqual(PROJECT);
    });

    it.each(['of', 'await', 'yield'])(
      'detects a setting in a file that divides a variable named `%s`',
      (name) => {
        // Contextual keywords are legal identifiers here, so `%s / 2` divides.
        expect(
          inspectTypedLinting(
            `const ${name} = 1;\nconst ratio = ${name} / 2;\nconst marker = '//*';\nexport default [{ languageOptions: { parserOptions: { project: './tsconfig.json' } } }];\n/* end */`
          )
        ).toEqual(PROJECT);
      }
    );

    it('detects a setting below a division inside a function body', () => {
      expect(
        inspectTypedLinting(
          `const ratio = (a) => { return a / 2; };\nexport default [{ languageOptions: { parserOptions: { projectService: true } } }];`
        )
      ).toEqual(PROJECT_SERVICE);
    });

    it('ignores a key commented out after a division', () => {
      expect(
        inspectTypedLinting(
          `const myreturn = 4;\nconst ratio = myreturn / 2; // projectService: true\nexport default [{ rules: {} }];`
        )
      ).toEqual(NONE);
    });

    it('ignores a key commented out after a division on a member access', () => {
      expect(
        inspectTypedLinting(
          `const ratio = counts.in / 2; // projectService: true\nexport default [{ rules: {} }];`
        )
      ).toEqual(NONE);
    });

    it('ignores a commented-out projectService setting', () => {
      expect(
        inspectTypedLinting(
          `// projectService: true\nexport default [{ rules: {} }];`
        )
      ).toEqual(NONE);
    });

    it('does not read typed linting from a config imported from another file', () => {
      // A spread config from another module names no file this walk reads, so it
      // contributes nothing and the caller stays free to configure the project.
      expect(
        inspectTypedLinting(
          `import baseConfig from '../../eslint.config.mjs';\nexport default [...baseConfig, { rules: {} }];\n`
        )
      ).toEqual(NONE);
    });

    it('reports a local array the file spreads as its own', () => {
      // It never leaves the file, so the setting is the file's own choice.
      expect(
        inspectTypedLinting(
          `const typed = [{ languageOptions: { parserOptions: { projectService: true } } }];\nexport default [...typed, { rules: {} }];\n`
        )
      ).toEqual(PROJECT_SERVICE);
    });

    it('ignores shorthand `rules` whose options carry a nested parserOptions', () => {
      // The nested `parserOptions` configures a rule, not the language; a config
      // that binds `rules` to a variable is skipped the same as an inline one.
      expect(
        inspectTypedLinting(
          `const rules = { 'x/y': ['error', { parserOptions: { project: true } }] };\nexport default [{ rules }];`
        )
      ).toEqual(NONE);
    });

    it('ignores `rules` referenced explicitly by name', () => {
      expect(
        inspectTypedLinting(
          `const rules = { 'x/y': ['error', { parserOptions: { project: true } }] };\nexport default [{ rules: rules }];`
        )
      ).toEqual(NONE);
    });

    it('ignores shorthand `settings` whose value carries a nested parserOptions', () => {
      expect(
        inspectTypedLinting(
          `const settings = { 'import/resolver': { typescript: { parserOptions: { project: true } } } };\nexport default [{ settings }];`
        )
      ).toEqual(NONE);
    });

    it('ignores shorthand `plugins` whose value carries a nested parserOptions', () => {
      expect(
        inspectTypedLinting(
          `const plugins = { foo: { configs: { recommended: { parserOptions: { project: true } } } } };\nexport default [{ plugins }];`
        )
      ).toEqual(NONE);
    });

    it('ignores an unused config-shaped declaration', () => {
      // A full config entry the export never includes configures nothing.
      expect(
        inspectTypedLinting(
          `const unused = { languageOptions: { parserOptions: { projectService: true } } };\nexport default [{ files: ['*.ts'], rules: {} }];`
        )
      ).toEqual(NONE);
    });

    it('detects a config entry referenced by name', () => {
      expect(
        inspectTypedLinting(
          `const entry = { languageOptions: { parserOptions: { project: true } } };\nexport default [entry];`
        )
      ).toEqual(PROJECT);
    });

    it('detects a `languageOptions` referenced by shorthand', () => {
      expect(
        inspectTypedLinting(
          `const languageOptions = { parserOptions: { projectService: true } };\nexport default [{ languageOptions }];`
        )
      ).toEqual(PROJECT_SERVICE);
    });

    it('detects a config the export aliases directly', () => {
      expect(
        inspectTypedLinting(
          `const config = [{ languageOptions: { parserOptions: { project: true } } }];\nexport default config;`
        )
      ).toEqual(PROJECT);
    });

    it('detects a setting inside a wrapper-call argument', () => {
      expect(
        inspectTypedLinting(
          `const entry = { languageOptions: { parserOptions: { projectService: true } } };\nexport default tseslint.config(entry);`
        )
      ).toEqual(PROJECT_SERVICE);
    });

    it('does not read a call in a property value as a config wrapper', () => {
      // `getFiles(...)` is an arbitrary function, not a config wrapper; its
      // argument is an input, so a `parserOptions` inside it must not be read.
      expect(
        inspectTypedLinting(
          `function getFiles(options) {\n  return ['**/*.js'];\n}\nexport default [{ files: getFiles({ parserOptions: { project: true } }) }];`
        )
      ).toEqual(NONE);
    });

    it('does not read a call spread into a config object', () => {
      expect(
        inspectTypedLinting(
          `function makeBase(options) {\n  return {};\n}\nexport default [{ ...makeBase({ languageOptions: { parserOptions: { project: true } } }), files: ['*.ts'] }];`
        )
      ).toEqual(NONE);
    });

    it('does not read a call inside an ordinary property array', () => {
      // The `files` array holds ordinary values, not config entries, so its
      // elements stay outside a config position.
      expect(
        inspectTypedLinting(
          `function getFile(options) {\n  return '**/*.js';\n}\nexport default [{ files: [getFile({ parserOptions: { project: true } })] }];`
        )
      ).toEqual(NONE);
    });

    it('does not read a call an IIFE returns at a property value', () => {
      expect(
        inspectTypedLinting(
          `function makeGlobs(options) {\n  return ['**/*.js'];\n}\nexport default [{ files: (() => makeGlobs({ parserOptions: { project: true } }))() }];`
        )
      ).toEqual(NONE);
    });

    it('reports uncertain when a local parserOptions is built by a call', () => {
      // The call could enable `project`; reporting no typed linting would let a
      // caller append a block that silently converts it to the project service.
      expect(
        inspectTypedLinting(
          `export default [{ languageOptions: { parserOptions: makeOptions() } }];`
        )
      ).toEqual(UNCERTAIN);
    });

    it('is not uncertain about a config that only spreads in another file', () => {
      // No local `parserOptions` key, so the imported composition stays safe to
      // append to rather than reading as undecided.
      expect(
        inspectTypedLinting(
          `import base from './base.js';\nexport default [...base, { files: ['*.ts'] }];`
        )
      ).toEqual(NONE);
    });

    it('detects a setting spread into a config object from a local binding', () => {
      expect(
        inspectTypedLinting(
          `const base = { languageOptions: { parserOptions: { project: true } } };\nexport default [{ ...base, files: ['*.ts'] }];`
        )
      ).toEqual(PROJECT);
    });

    it('detects a config exported with `module.exports`', () => {
      expect(
        inspectTypedLinting(
          `const entry = { languageOptions: { parserOptions: { projectService: true } } };\nmodule.exports = [entry];`
        )
      ).toEqual(PROJECT_SERVICE);
    });

    it('detects a setting in the truthy branch of a conditional entry', () => {
      // Either branch may run, so a setting in either counts; overwriting the
      // truthy branch would undo its typed-linting choice.
      expect(
        inspectTypedLinting(
          `export default [\n  process.env.USE_PROJECT\n    ? { languageOptions: { parserOptions: { project: true } } }\n    : { rules: {} },\n];`
        )
      ).toEqual(PROJECT);
    });

    it('detects a setting in the falsy branch of a conditional entry', () => {
      expect(
        inspectTypedLinting(
          `export default [\n  cond ? { rules: {} } : { languageOptions: { parserOptions: { projectService: true } } },\n];`
        )
      ).toEqual(PROJECT_SERVICE);
    });

    it('detects a setting behind a `||` short-circuit', () => {
      expect(
        inspectTypedLinting(
          `export default base || [{ languageOptions: { parserOptions: { projectService: true } } }];`
        )
      ).toEqual(PROJECT_SERVICE);
    });

    it('detects a setting behind a `??` short-circuit', () => {
      expect(
        inspectTypedLinting(
          `export default base ?? [{ languageOptions: { parserOptions: { project: true } } }];`
        )
      ).toEqual(PROJECT);
    });

    it('detects a setting behind a `&&` short-circuit', () => {
      expect(
        inspectTypedLinting(
          `export default [\n  process.env.USE_PROJECT && { languageOptions: { parserOptions: { project: true } } },\n];`
        )
      ).toEqual(PROJECT);
    });

    it('reports nothing when neither conditional branch configures typed linting', () => {
      expect(
        inspectTypedLinting(
          `export default [\n  cond ? { rules: {} } : { files: ['*.ts'] },\n];`
        )
      ).toEqual(NONE);
    });

    it('detects a setting in the right operand of a comma expression', () => {
      // A comma expression always evaluates to its right operand, so the config
      // object there is the entry ESLint sees.
      expect(
        inspectTypedLinting(
          `export default [\n  (sideEffect(), { languageOptions: { parserOptions: { project: true } } }),\n];`
        )
      ).toEqual(PROJECT);
    });

    it('detects a setting in a comma expression at the export root', () => {
      expect(
        inspectTypedLinting(
          `export default (init(), [{ languageOptions: { parserOptions: { projectService: true } } }]);`
        )
      ).toEqual(PROJECT_SERVICE);
    });

    it('reports nothing when a comma expression right operand has no typed linting', () => {
      expect(
        inspectTypedLinting(
          `export default [\n  (sideEffect(), { rules: {} }),\n];`
        )
      ).toEqual(NONE);
    });

    it('detects a config reached through a property access on a local object', () => {
      expect(
        inspectTypedLinting(
          `const configs = { typed: { languageOptions: { parserOptions: { project: true } } } };\nexport default [configs.typed];`
        )
      ).toEqual(PROJECT);
    });

    it('detects a config reached through an element access on a local object', () => {
      expect(
        inspectTypedLinting(
          `const configs = { typed: { languageOptions: { parserOptions: { projectService: true } } } };\nexport default [configs['typed']];`
        )
      ).toEqual(PROJECT_SERVICE);
    });

    it('reads each accessed property independently for sibling accesses', () => {
      // The typed config is the second entry; resolving the first must not shadow
      // the registry so the second still resolves.
      expect(
        inspectTypedLinting(
          `const configs = {\n  plain: { rules: {} },\n  typed: { languageOptions: { parserOptions: { project: true } } },\n};\nexport default [configs.plain, configs.typed];`
        )
      ).toEqual(PROJECT);
    });

    it('does not read a property access on an imported object', () => {
      expect(
        inspectTypedLinting(
          `import registry from './registry.js';\nexport default [registry.typed, { rules: {} }];`
        )
      ).toEqual(NONE);
    });

    it('does not read a property access with a dynamic key', () => {
      expect(
        inspectTypedLinting(
          `const configs = { typed: { languageOptions: { parserOptions: { project: true } } } };\nexport default [configs[key]];`
        )
      ).toEqual(NONE);
    });

    it('resolves a parserOptions value reached through a member access', () => {
      expect(
        inspectTypedLinting(
          `const registry = { opts: { project: true } };\nexport default [{ languageOptions: { parserOptions: registry.opts } }];`
        )
      ).toEqual(PROJECT);
    });

    it('resolves a parserOptions value reached through an element access', () => {
      expect(
        inspectTypedLinting(
          `const registry = { opts: { projectService: true } };\nexport default [{ languageOptions: { parserOptions: registry['opts'] } }];`
        )
      ).toEqual(PROJECT_SERVICE);
    });

    it('reads a projectService opt-out reached through a member access', () => {
      // The member access must be followed to its value, not merely detected as
      // present, so an explicit `false` still reads as an opt-out.
      expect(
        inspectTypedLinting(
          `const registry = { opts: { projectService: false } };\nexport default [{ languageOptions: { parserOptions: registry.opts } }];`
        )
      ).toEqual(OPT_OUT);
    });

    it('resolves a parserOptions value reached through a nested member access', () => {
      expect(
        inspectTypedLinting(
          `const registry = { group: { opts: { projectService: true } } };\nexport default [{ languageOptions: { parserOptions: registry.group.opts } }];`
        )
      ).toEqual(PROJECT_SERVICE);
    });

    it('does not read a parserOptions value on an imported object', () => {
      // A local `parserOptions` key pointing at an unreadable value is undecided,
      // unlike a config that merely spreads in an imported array (no local
      // `parserOptions`), which stays safe to append to.
      expect(
        inspectTypedLinting(
          `import registry from './registry.js';\nexport default [{ languageOptions: { parserOptions: registry.opts } }];`
        )
      ).toEqual(UNCERTAIN);
    });

    it('does not read a parserOptions value behind a dynamic member key', () => {
      expect(
        inspectTypedLinting(
          `const registry = { opts: { project: true } };\nexport default [{ languageOptions: { parserOptions: registry[key] } }];`
        )
      ).toEqual(UNCERTAIN);
    });

    it('resolves a member value provided by a shorthand property', () => {
      expect(
        inspectTypedLinting(
          `const opts = { project: true };\nconst registry = { opts };\nexport default [{ languageOptions: { parserOptions: registry.opts } }];`
        )
      ).toEqual(PROJECT);
    });

    it('resolves a member value provided by a spread property', () => {
      expect(
        inspectTypedLinting(
          `const base = { opts: { projectService: true } };\nconst registry = { ...base };\nexport default [{ languageOptions: { parserOptions: registry.opts } }];`
        )
      ).toEqual(PROJECT_SERVICE);
    });

    it('resolves a config entry provided by a shorthand property', () => {
      expect(
        inspectTypedLinting(
          `const typed = { languageOptions: { parserOptions: { project: true } } };\nconst configs = { typed };\nexport default [configs.typed];`
        )
      ).toEqual(PROJECT);
    });

    it('lets a spread override an earlier property in a member lookup', () => {
      // At runtime `registry.opts` is the spread's value, so its `project` wins.
      expect(
        inspectTypedLinting(
          `const override = { opts: { project: true } };\nconst registry = { opts: { rules: {} }, ...override };\nexport default [{ languageOptions: { parserOptions: registry.opts } }];`
        )
      ).toEqual(PROJECT);
    });

    it('lets a later property override an earlier spread in a member lookup', () => {
      // The direct `opts` comes last, so `registry.opts` has no typed linting.
      expect(
        inspectTypedLinting(
          `const override = { opts: { project: true } };\nconst registry = { ...override, opts: { rules: {} } };\nexport default [{ languageOptions: { parserOptions: registry.opts } }];`
        )
      ).toEqual(NONE);
    });

    it('does not read a member value whose shorthand binding is imported', () => {
      expect(
        inspectTypedLinting(
          `import opts from './opts.js';\nconst registry = { opts };\nexport default [{ languageOptions: { parserOptions: registry.opts } }];`
        )
      ).toEqual(UNCERTAIN);
    });

    it('reads an object spread again after it was masked through another spread', () => {
      // `registry.opts` is the final `...base`, which restores `project: true`.
      expect(
        inspectTypedLinting(
          `const base = { opts: { project: true } };\nconst masked = { ...base, opts: {} };\nconst registry = { ...masked, ...base };\nexport default [{ languageOptions: { parserOptions: registry.opts } }];`
        )
      ).toEqual(PROJECT);
    });

    it('reads a member value from the last of two spreads of the same object', () => {
      expect(
        inspectTypedLinting(
          `const base = { opts: { project: true } };\nconst registry = { ...base, opts: {}, ...base };\nexport default [{ languageOptions: { parserOptions: registry.opts } }];`
        )
      ).toEqual(PROJECT);
    });

    it('reads a parserOptions spread again after an intervening override', () => {
      // `{ ...base, project: false, ...base }` ends with `project: true`.
      expect(
        inspectTypedLinting(
          `const base = { project: true };\nexport default [{ languageOptions: { parserOptions: { ...base, project: false, ...base } } }];`
        )
      ).toEqual(PROJECT);
    });

    it('reads a projectService spread again after an intervening override', () => {
      expect(
        inspectTypedLinting(
          `const base = { projectService: true };\nexport default [{ languageOptions: { parserOptions: { ...base, projectService: false, ...base } } }];`
        )
      ).toEqual(PROJECT_SERVICE);
    });

    it('terminates on a circular object spread', () => {
      expect(
        inspectTypedLinting(
          `const a = { ...b };\nconst b = { ...a };\nexport default [{ languageOptions: { parserOptions: a.opts } }];`
        )
      ).toEqual(UNCERTAIN);
    });

    it('lets a present but unreadable spread property clear an earlier value', () => {
      // `registry.opts` is `override.opts`, whose value the scanner can't read, so
      // it must not report the earlier `...base` value that runtime replaces; the
      // unreadable value reads as undecided rather than as that stale `project`.
      expect(
        inspectTypedLinting(
          `const base = { opts: { project: true } };\nconst source = { opts: {} };\nconst { opts } = source;\nconst override = { opts };\nconst registry = { ...base, ...override };\nexport default [{ languageOptions: { parserOptions: registry.opts } }];`
        )
      ).toEqual(UNCERTAIN);
    });

    it('keeps an earlier value when a later spread object is unreadable', () => {
      // An unreadable spread can't be shown to carry `opts`, so the readable
      // `...base` value stands.
      expect(
        inspectTypedLinting(
          `const base = { opts: { project: true } };\nconst registry = { ...base, ...getExtra() };\nexport default [{ languageOptions: { parserOptions: registry.opts } }];`
        )
      ).toEqual(PROJECT);
    });
  });

  describe('isTypedLintingEnabled', () => {
    it('is enabled by the new flag', () => {
      expect(isTypedLintingEnabled({ enableTypedLinting: true })).toBe(true);
    });

    it('falls back to the deprecated setParserOptionsProject flag', () => {
      expect(isTypedLintingEnabled({ setParserOptionsProject: true })).toBe(
        true
      );
    });

    it('honors the deprecated flag even when enableTypedLinting defaults to false', () => {
      // A generator whose `enableTypedLinting` schema default is `false` must
      // still enable typed linting for a user who set the deprecated flag.
      expect(
        isTypedLintingEnabled({
          enableTypedLinting: false,
          setParserOptionsProject: true,
        })
      ).toBe(true);
    });

    it('is disabled when neither flag is set', () => {
      expect(isTypedLintingEnabled({})).toBe(false);
    });
  });

  describe('addTypedLintingToFlatConfig', () => {
    let originalUseFlatConfig: string | undefined;
    beforeEach(() => {
      originalUseFlatConfig = process.env.ESLINT_USE_FLAT_CONFIG;
      process.env.ESLINT_USE_FLAT_CONFIG = 'true';
    });
    afterEach(() => {
      process.env.ESLINT_USE_FLAT_CONFIG = originalUseFlatConfig;
    });

    it.each([
      [
        'a relative import',
        `import baseConfig from '../../eslint.config.mjs';\nexport default [...baseConfig, { rules: {} }];\n`,
      ],
      [
        'a package',
        `import baseConfig from '@myorg/eslint-config';\nexport default [...baseConfig, { rules: {} }];\n`,
      ],
      [
        'a call it cannot evaluate',
        `import { makeConfig } from '../../tools/eslint.mjs';\nexport default [...makeConfig(), { rules: {} }];\n`,
      ],
    ])('defuses `project` when the config spreads in %s', (_name, config) => {
      // A `project` reaches a config through routes no walk covers: a config from
      // another file, ESLint 9's own `extends`, an `Object.assign`, a `concat`,
      // or a later block another generator appends. Defusing unconditionally is
      // the only way to keep every one of those from throwing.
      tree.write('eslint.config.mjs', `export default [{ rules: {} }];\n`);
      tree.write('libs/test/eslint.config.mjs', config);

      addTypedLintingToFlatConfig(tree, 'libs/test');

      const content = tree.read('libs/test/eslint.config.mjs', 'utf-8');
      expect(content).toContain('projectService: true');
      expect(content).toContain('project: null');
    });

    it('explains in a comment when the defusing line can go', () => {
      tree.write(
        'libs/test/eslint.config.mjs',
        `export default [{ rules: {} }];\n`
      );

      addTypedLintingToFlatConfig(tree, 'libs/test');

      expect(tree.read('libs/test/eslint.config.mjs', 'utf-8')).toContain(
        'Remove this once you know none of them set it.'
      );
    });

    it('appends a projectService block with import.meta.dirname to an mjs flat config', () => {
      tree.write(
        'libs/test/eslint.config.mjs',
        `export default [{ files: ['**/*.ts'], rules: {} }];\n`
      );

      addTypedLintingToFlatConfig(tree, 'libs/test');

      const content = tree.read('libs/test/eslint.config.mjs', 'utf-8');
      expect(content).toContain('projectService: true');
      expect(content).toContain('tsconfigRootDir: import.meta.dirname');
    });

    it('appends a projectService block with __dirname to a cjs flat config', () => {
      tree.write(
        'libs/test/eslint.config.cjs',
        `module.exports = [{ files: ['**/*.ts'], rules: {} }];\n`
      );

      addTypedLintingToFlatConfig(tree, 'libs/test');

      const content = tree.read('libs/test/eslint.config.cjs', 'utf-8');
      expect(content).toContain('projectService: true');
      expect(content).toContain('tsconfigRootDir: __dirname');
      expect(content).not.toContain('import.meta.dirname');
    });

    it('does not classify a cjs file with a commented `export default` as mjs', () => {
      tree.write(
        'libs/test/eslint.config.cjs',
        `// example: export default [];\nmodule.exports = [{ files: ['**/*.ts'], rules: {} }];\n`
      );

      addTypedLintingToFlatConfig(tree, 'libs/test');

      const content = tree.read('libs/test/eslint.config.cjs', 'utf-8');
      expect(content).toContain('tsconfigRootDir: __dirname');
      expect(content).not.toContain('import.meta.dirname');
    });

    it('is a no-op when no flat config file is present', () => {
      tree.write('libs/test/.eslintrc.json', '{}');
      // No flat config file at the project root; helper should silently return.
      addTypedLintingToFlatConfig(tree, 'libs/test');
      expect(tree.read('libs/test/.eslintrc.json', 'utf-8')).toBe('{}');
    });

    it('does not append a second projectService block when one already exists', () => {
      tree.write(
        'libs/test/eslint.config.mjs',
        `export default [{ files: ['**/*.ts'], rules: {} }];\n`
      );

      // A re-run (or a consumer re-adding typed linting to a config that already
      // has it) must not duplicate the projectService block.
      addTypedLintingToFlatConfig(tree, 'libs/test');
      addTypedLintingToFlatConfig(tree, 'libs/test');

      const content = tree.read('libs/test/eslint.config.mjs', 'utf-8');
      expect(content.match(/projectService: true/g)).toHaveLength(1);
    });

    it('does not append a projectService block when a legacy parserOptions.project block exists', () => {
      // A config already configured with the legacy `parserOptions.project`
      // shape must not get a second, conflicting projectService block.
      tree.write(
        'libs/test/eslint.config.mjs',
        `export default [{ files: ['**/*.ts'], languageOptions: { parserOptions: { project: ['./tsconfig.json'] } }, rules: {} }];\n`
      );

      addTypedLintingToFlatConfig(tree, 'libs/test');

      const content = tree.read('libs/test/eslint.config.mjs', 'utf-8');
      expect(content).not.toContain('projectService');
      expect(content).toContain("project: ['./tsconfig.json']");
    });

    it('does not append a projectService block when `parserOptions.project` is `true`', () => {
      // typescript-eslint throws when `project` and `projectService` are both
      // enabled, so a boolean `project` must be detected like an array one.
      tree.write(
        'libs/test/eslint.config.mjs',
        `export default [{ files: ['**/*.ts'], languageOptions: { parserOptions: { project: true } }, rules: {} }];\n`
      );

      addTypedLintingToFlatConfig(tree, 'libs/test');

      const content = tree.read('libs/test/eslint.config.mjs', 'utf-8');
      expect(content).not.toContain('projectService');
      expect(content).toContain('project: true');
    });

    it('appends a projectService block when `parserOptions.project` is `false`', () => {
      // A falsy `project` gives no type information and doesn't conflict with
      // `projectService`, so `--enableTypedLinting` must still take effect.
      tree.write(
        'libs/test/eslint.config.mjs',
        `export default [{ files: ['**/*.ts'], languageOptions: { parserOptions: { project: false } }, rules: {} }];\n`
      );

      addTypedLintingToFlatConfig(tree, 'libs/test');

      const content = tree.read('libs/test/eslint.config.mjs', 'utf-8');
      expect(content).toContain('projectService: true');
      expect(content).toContain('project: false');
    });

    it('honors an explicit projectService: false opt-out', () => {
      // A user who disabled the project service must not get a conflicting
      // `projectService: true` block appended on top of their opt-out.
      tree.write(
        'libs/test/eslint.config.mjs',
        `export default [{ files: ['**/*.ts'], languageOptions: { parserOptions: { projectService: false } }, rules: {} }];\n`
      );

      addTypedLintingToFlatConfig(tree, 'libs/test');

      const content = tree.read('libs/test/eslint.config.mjs', 'utf-8');
      expect(content).not.toContain('projectService: true');
      expect(content).toContain('projectService: false');
    });

    it('warns and leaves the config untouched when it is not a plain array export', () => {
      const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
      const original = `export default tseslint.config({ files: ['**/*.ts'], rules: {} });\n`;
      tree.write('libs/test/eslint.config.mjs', original);

      addTypedLintingToFlatConfig(tree, 'libs/test');

      expect(tree.read('libs/test/eslint.config.mjs', 'utf-8')).toBe(original);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not enable typed linting')
      );
      warn.mockRestore();
    });

    it('warns and leaves the config untouched when a local parserOptions cannot be read', () => {
      // Appending would risk converting an unread `project` setup to the project
      // service, so the config is left for the user to complete.
      const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
      const original = `export default [{ languageOptions: { parserOptions: makeOptions() } }];\n`;
      tree.write('libs/test/eslint.config.mjs', original);

      addTypedLintingToFlatConfig(tree, 'libs/test');

      expect(tree.read('libs/test/eslint.config.mjs', 'utf-8')).toBe(original);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not tell whether typed linting')
      );
      warn.mockRestore();
    });

    it('uses __dirname for a cts config written with `export default`', () => {
      // `.cts` builds into CommonJS, where `import.meta` is a TypeScript error,
      // so the extension has to outrank the ESM-looking content.
      tree.write(
        'libs/test/eslint.config.cts',
        `export default [{ files: ['**/*.ts'], rules: {} }];\n`
      );

      addTypedLintingToFlatConfig(tree, 'libs/test');

      const content = tree.read('libs/test/eslint.config.cts', 'utf-8');
      expect(content).toContain('tsconfigRootDir: __dirname');
      expect(content).not.toContain('import.meta.dirname');
    });

    it('uses import.meta.dirname for an mts config written with `module.exports`', () => {
      tree.write(
        'libs/test/eslint.config.mts',
        `module.exports = [{ files: ['**/*.ts'], rules: {} }];\n`
      );

      addTypedLintingToFlatConfig(tree, 'libs/test');

      const content = tree.read('libs/test/eslint.config.mts', 'utf-8');
      expect(content).toContain('tsconfigRootDir: import.meta.dirname');
      expect(content).not.toContain('tsconfigRootDir: __dirname');
    });

    it('appends over a spread config that sets parserOptions.project', () => {
      // Its globs need not reach this project, so an inherited `project` is no
      // reason to leave the project without typed linting. The appended block
      // comes last, so its `project: null` wins the merge and nothing throws.
      tree.write(
        'eslint.config.mjs',
        `export default [{ files: ['**/*.ts'], languageOptions: { parserOptions: { project: ['./tsconfig.json'] } } }];\n`
      );
      tree.write(
        'libs/test/eslint.config.mjs',
        `import baseConfig from '../../eslint.config.mjs';\nexport default [...baseConfig, { rules: {} }];\n`
      );

      addTypedLintingToFlatConfig(tree, 'libs/test');

      const content = tree.read('libs/test/eslint.config.mjs', 'utf-8');
      expect(content).toContain('projectService: true');
      expect(content).toContain('project: null');
    });

    it('appends over a spread config whose project service is file-scoped', () => {
      // A base entry limited to some files does not cover this project, so its
      // `projectService` must not suppress the requested block. Only the
      // config's own typed linting is a reason to skip.
      tree.write(
        'eslint.config.mjs',
        `export default [{ files: ['special/**/*.ts'], languageOptions: { parserOptions: { projectService: true } } }];\n`
      );
      tree.write(
        'libs/test/eslint.config.mjs',
        `import baseConfig from '../../eslint.config.mjs';\nexport default [...baseConfig, { rules: {} }];\n`
      );

      addTypedLintingToFlatConfig(tree, 'libs/test');

      const content = tree.read('libs/test/eslint.config.mjs', 'utf-8');
      expect(content).toContain('projectService: true');
      expect(content).toContain('project: null');
    });
  });
});
