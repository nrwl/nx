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
  detectTypedLintingShape,
  findEslintFile,
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

  describe('detectTypedLintingShape', () => {
    it('returns null when no typed linting is configured', () => {
      expect(detectTypedLintingShape('module.exports = [];')).toBeNull();
      expect(
        detectTypedLintingShape('{"overrides": [{"files": ["*.ts"]}]}')
      ).toBeNull();
    });

    it('detects project-service shape', () => {
      expect(
        detectTypedLintingShape(
          'export default [{ languageOptions: { parserOptions: { projectService: true } } }];'
        )
      ).toBe('project-service');
    });

    it('detects an explicit projectService: false opt-out as project-service', () => {
      // A user who set `projectService: false` made a deliberate choice; it must
      // be detected so callers don't append a conflicting `projectService: true`.
      expect(
        detectTypedLintingShape(
          'export default [{ languageOptions: { parserOptions: { projectService: false } } }];'
        )
      ).toBe('project-service');
    });

    it('detects parser-options-project shape (flat config)', () => {
      expect(
        detectTypedLintingShape(
          'export default [{ languageOptions: { parserOptions: { project: ["./tsconfig.json"] } } }];'
        )
      ).toBe('parser-options-project');
    });

    it('detects parser-options-project shape (JSON)', () => {
      expect(
        detectTypedLintingShape(
          '{"overrides": [{"parserOptions": {"project": ["./tsconfig.json"]}}]}'
        )
      ).toBe('parser-options-project');
    });

    it('ignores the word "project" in unrelated contexts', () => {
      // The previous regex matched any `project:` after `parserOptions:`, even
      // in comments. Verify the tightened regex no longer false-positives.
      expect(
        detectTypedLintingShape(
          `// configure parserOptions for your project: false\nexport default [];`
        )
      ).toBeNull();
    });

    it('does not match a `project` key outside the parserOptions block', () => {
      // `parserOptions` here has no `project`; the only `project` array lives in
      // an unrelated `settings` block (e.g. eslint-import-resolver-typescript).
      expect(
        detectTypedLintingShape(
          `export default [{ languageOptions: { parserOptions: { ecmaVersion: 2022 } }, settings: { 'import/resolver': { typescript: { project: ['./tsconfig.json'] } } } }];`
        )
      ).toBeNull();
    });

    it('detects parser-options-project past a nested object inside parserOptions', () => {
      expect(
        detectTypedLintingShape(
          `export default [{ languageOptions: { parserOptions: { ecmaFeatures: { jsx: true }, project: ['./tsconfig.json'] } } }];`
        )
      ).toBe('parser-options-project');
    });

    it('detects parser-options-project across multiple parserOptions blocks', () => {
      // The first `parserOptions` block has no `project`; the scan must continue
      // to the second block instead of stopping at the first.
      expect(
        detectTypedLintingShape(
          `export default [{ languageOptions: { parserOptions: { ecmaVersion: 2022 } } }, { languageOptions: { parserOptions: { project: ['./tsconfig.json'] } } }];`
        )
      ).toBe('parser-options-project');
    });

    it('detects parser-options-project when a string value contains a brace', () => {
      // A `}` inside a string value must not prematurely close the
      // parserOptions block scan and hide a later `project` key.
      expect(
        detectTypedLintingShape(
          `export default [{ languageOptions: { parserOptions: { tsconfigRootDir: 'a } b', project: ['./tsconfig.json'] } } }];`
        )
      ).toBe('parser-options-project');
    });

    it('detects parser-options-project when `project` is set to `true`', () => {
      // `project` accepts `boolean | string | string[] | null`, so a boolean is
      // as conflicting with `projectService` as an array is.
      expect(
        detectTypedLintingShape(
          'export default [{ languageOptions: { parserOptions: { project: true } } }];'
        )
      ).toBe('parser-options-project');
    });

    it.each(['false', 'null', 'undefined'])(
      'does not count `project: %s`, which leaves typed linting off',
      (value) => {
        // typescript-eslint only builds a program for a truthy `project`, so a
        // falsy one is neither typed linting nor a conflict for `projectService`.
        expect(
          detectTypedLintingShape(
            `export default [{ languageOptions: { parserOptions: { project: ${value} } } }];`
          )
        ).toBeNull();
      }
    );

    it('does not count `"project": false` (JSON)', () => {
      expect(
        detectTypedLintingShape(
          '{"overrides": [{"parserOptions": {"project": false}}]}'
        )
      ).toBeNull();
    });

    it('counts a variable reference whose name starts with a falsy literal', () => {
      // `falseyPaths` is an identifier, not `false`; we can't evaluate it, so it
      // has to count.
      expect(
        detectTypedLintingShape(
          'export default [{ languageOptions: { parserOptions: { project: falseyPaths } } }];'
        )
      ).toBe('parser-options-project');
    });

    it('detects parser-options-project when `project` is a template literal', () => {
      expect(
        detectTypedLintingShape(
          'export default [{ languageOptions: { parserOptions: { project: `${import.meta.dirname}/tsconfig.json` } } }];'
        )
      ).toBe('parser-options-project');
    });

    it('detects parser-options-project when `project` is a variable reference', () => {
      expect(
        detectTypedLintingShape(
          'export default [{ languageOptions: { parserOptions: { project: tsconfigPaths } } }];'
        )
      ).toBe('parser-options-project');
    });

    it('detects project-service when `projectService` is a variable reference', () => {
      expect(
        detectTypedLintingShape(
          'export default [{ languageOptions: { parserOptions: { projectService: projectServiceOptions } } }];'
        )
      ).toBe('project-service');
    });

    it('detects project-service when `projectService` uses the ES shorthand', () => {
      // The value lives in a variable we can't evaluate, so the shorthand has to
      // count; appending our own block would override the user's choice.
      expect(
        detectTypedLintingShape(
          'const projectService = false;\nexport default [{ languageOptions: { parserOptions: { projectService } } }];'
        )
      ).toBe('project-service');
    });

    it('detects parser-options-project when `project` uses the ES shorthand', () => {
      // Appending `projectService: true` next to a truthy `project` makes
      // typescript-eslint fatal on every file it type-checks.
      expect(
        detectTypedLintingShape(
          "const project = ['tsconfig.json'];\nexport default [{ languageOptions: { parserOptions: { project } } }];"
        )
      ).toBe('parser-options-project');
    });

    it('detects the ES shorthand when other keys follow it', () => {
      expect(
        detectTypedLintingShape(
          'export default [{ languageOptions: { parserOptions: { project, tsconfigRootDir: __dirname } } }];'
        )
      ).toBe('parser-options-project');
    });

    it('does not mistake `projectService` for a shorthand `project`', () => {
      expect(
        detectTypedLintingShape(
          'export default [{ languageOptions: { parserOptions: { projectService: false } } }];'
        )
      ).toBe('project-service');
    });

    it('detects a setting that follows a regex literal containing `//`', () => {
      // The `//` is regex content, not the start of a comment.
      expect(
        detectTypedLintingShape(
          `export default [{ settings: { pattern: /[//]/ }, languageOptions: { parserOptions: { projectService: true } } }];`
        )
      ).toBe('project-service');
    });

    it('ignores a key that only appears in a trailing line comment', () => {
      expect(
        detectTypedLintingShape(
          `export default [\n  { rules: {} }, // projectService: true\n];`
        )
      ).toBeNull();
    });

    it('detects a setting in a file that also divides', () => {
      expect(
        detectTypedLintingShape(
          `const ratio = width / 2;\nexport default [{ languageOptions: { parserOptions: { projectService: true } } }];`
        )
      ).toBe('project-service');
    });

    it('detects a setting sharing a line with a regex literal containing `//`', () => {
      expect(
        detectTypedLintingShape(
          `const isTest = (s) => { return /[//]/.test(s); }, opts = { parserOptions: { projectService: true } };`
        )
      ).toBe('project-service');
    });

    it('does not count the key when it only appears inside a string', () => {
      expect(
        detectTypedLintingShape(
          `export default [{ rules: { 'x/y': ['error', { message: 'prefer projectService, always' }] } }];`
        )
      ).toBeNull();
    });

    it('does not count a `project` substring inside a glob value', () => {
      expect(
        detectTypedLintingShape(
          `export default [{ languageOptions: { parserOptions: { cacheDir: 'tmp/{eslint,project}' } } }];`
        )
      ).toBeNull();
    });

    it('reads a legacy `.eslintrc` that carries comments', () => {
      expect(
        detectTypedLintingShape(
          `{\n  // typed linting\n  "overrides": [{ "parserOptions": { "projectService": true } }],\n}`
        )
      ).toBe('project-service');
    });

    it('reads a legacy YAML config', () => {
      expect(
        detectTypedLintingShape(
          `overrides:\n  - files: ['*.ts']\n    parserOptions:\n      project: ['apps/demo/tsconfig.*?.json']\n`
        )
      ).toBe('parser-options-project');
    });

    it('reads `projectService` from a legacy YAML config', () => {
      expect(
        detectTypedLintingShape(
          `overrides:\n  - files: ['*.ts']\n    parserOptions:\n      projectService: true\n`
        )
      ).toBe('project-service');
    });

    it('reads a YAML config that carries comments', () => {
      expect(
        detectTypedLintingShape(
          `# typed linting\nroot: true\noverrides:\n  - parserOptions:\n      project: './tsconfig.json'\n`
        )
      ).toBe('parser-options-project');
    });

    it('does not count a falsy `project` in a YAML config', () => {
      expect(
        detectTypedLintingShape(
          `overrides:\n  - parserOptions:\n      project: null\n`
        )
      ).toBeNull();
    });

    it('prefers the JS parse over YAML for a one-line JS config', () => {
      // `module.exports = {root: true};` is also valid YAML, as a mapping keyed
      // on the whole line, so the JS parse has to win.
      expect(
        detectTypedLintingShape(
          `module.exports = {parserOptions: {project: ['./tsconfig.json']}};`
        )
      ).toBe('parser-options-project');
    });

    it('reads a legacy `.eslintrc.js`, whose content is JS rather than JSON', () => {
      expect(
        detectTypedLintingShape(
          `module.exports = { overrides: [{ parserOptions: { project: './tsconfig.json' } }] };`
        )
      ).toBe('parser-options-project');
    });

    it('detects a `parserOptions` object referenced under another name', () => {
      expect(
        detectTypedLintingShape(
          `const opts = { project: ['tsconfig.json'] };\nexport default [{ languageOptions: { parserOptions: opts } }];`
        )
      ).toBe('parser-options-project');
    });

    it('ignores a `parserOptions` variable the config never references', () => {
      // Declared but unused, so it configures nothing and must not suppress an
      // explicit typed-linting request.
      expect(
        detectTypedLintingShape(
          `const parserOptions = { project: './unused.json' };\nexport default [{ rules: {} }];`
        )
      ).toBeNull();
    });

    it('resolves a reference to the declaration in scope, not a shadowed one', () => {
      expect(
        detectTypedLintingShape(
          `const opts = { ecmaVersion: 2022 };\nfunction helper() {\n  const opts = { project: './helper.json' };\n  return opts;\n}\nexport default [{ languageOptions: { parserOptions: opts } }];`
        )
      ).toBeNull();
    });

    it('stops at a parameter that shadows an outer object', () => {
      expect(
        detectTypedLintingShape(
          `const opts = { project: './unrelated.json' };\nfunction makeConfig(opts) {\n  return { languageOptions: { parserOptions: opts } };\n}\nexport default [makeConfig({ ecmaVersion: 2022 })];`
        )
      ).toBeNull();
    });

    it.each([
      ['a destructured parameter', 'function makeConfig({ opts }) {'],
      [
        'a renamed destructured parameter',
        'function makeConfig({ base: opts }) {',
      ],
    ])('stops at %s', (_name, signature) => {
      expect(
        detectTypedLintingShape(
          `const opts = { project: './unrelated.json' };\n${signature}\n  return { languageOptions: { parserOptions: opts } };\n}\nexport default [makeConfig({})];`
        )
      ).toBeNull();
    });

    it('reads through an `as const` on a TypeScript flat config', () => {
      // `eslintFlatConfigFilenames` covers `.ts`/`.cts`/`.mts`, so TS-only syntax
      // reaches here. Missing the opt-out would overwrite it with `true`.
      expect(
        detectTypedLintingShape(
          `const opts = { projectService: false } as const;\nexport default [{ languageOptions: { parserOptions: opts } }];`
        )
      ).toBe('project-service');
    });

    it('reads a setting brought in by a spread', () => {
      expect(
        detectTypedLintingShape(
          `const typed = { projectService: false };\nexport default [{ languageOptions: { parserOptions: { ...typed } } }];`
        )
      ).toBe('project-service');
    });

    it('follows an alias chain to the declaring object', () => {
      expect(
        detectTypedLintingShape(
          `const typed = { projectService: false };\nconst opts = typed;\nexport default [{ languageOptions: { parserOptions: opts } }];`
        )
      ).toBe('project-service');
    });

    it('lets a later spread override an earlier `project`', () => {
      // `{ project: [...], ...typed }` ends up with `project: false` at runtime.
      expect(
        detectTypedLintingShape(
          `const typed = { project: false };\nexport default [{ languageOptions: { parserOptions: { project: ['tsconfig.json'], ...typed } } }];`
        )
      ).toBeNull();
    });

    it('counts a spread it cannot resolve, rather than assuming it is empty', () => {
      expect(
        detectTypedLintingShape(
          `export default [{ languageOptions: { parserOptions: { ...getBase() } } }];`
        )
      ).toBe('parser-options-project');
    });

    it('terminates on a circular alias', () => {
      expect(
        detectTypedLintingShape(
          `const a = b;\nconst b = a;\nexport default [{ languageOptions: { parserOptions: a } }];`
        )
      ).toBeNull();
    });

    it('reads through a `satisfies` expression', () => {
      expect(
        detectTypedLintingShape(
          `const opts = { project: ['tsconfig.json'] } satisfies object;\nexport default [{ languageOptions: { parserOptions: opts } }];`
        )
      ).toBe('parser-options-project');
    });

    it('reads through parentheses around an inline object', () => {
      expect(
        detectTypedLintingShape(
          `export default [{ languageOptions: { parserOptions: ({ projectService: false }) } }];`
        )
      ).toBe('project-service');
    });

    it('stops at a destructured variable', () => {
      expect(
        detectTypedLintingShape(
          `const opts = { project: './unrelated.json' };\nfunction makeConfig(input) {\n  const { opts } = input;\n  return { languageOptions: { parserOptions: opts } };\n}\nexport default [makeConfig({})];`
        )
      ).toBeNull();
    });

    it('stops at a `catch` binding', () => {
      expect(
        detectTypedLintingShape(
          `const opts = { project: './unrelated.json' };\nfunction makeConfig() {\n  try { risky(); } catch (opts) { return { languageOptions: { parserOptions: opts } }; }\n}\nexport default [makeConfig()];`
        )
      ).toBeNull();
    });

    it('stops at a loop binding', () => {
      expect(
        detectTypedLintingShape(
          `const opts = { project: './unrelated.json' };\nfunction makeConfig(all) {\n  for (const opts of all) { return { languageOptions: { parserOptions: opts } }; }\n}\nexport default [makeConfig([])];`
        )
      ).toBeNull();
    });

    it('stops at a nearer binding whose value cannot be read statically', () => {
      expect(
        detectTypedLintingShape(
          `const opts = { project: './unrelated.json' };\nfunction makeConfig() {\n  const opts = buildOptions();\n  return { languageOptions: { parserOptions: opts } };\n}\nexport default [makeConfig()];`
        )
      ).toBeNull();
    });

    it('resolves a reference declared in the same function scope', () => {
      expect(
        detectTypedLintingShape(
          `export default (() => {\n  const opts = { project: ['tsconfig.json'] };\n  return [{ languageOptions: { parserOptions: opts } }];\n})();`
        )
      ).toBe('parser-options-project');
    });

    it('ignores a `parserOptions` variable local to an unrelated helper', () => {
      expect(
        detectTypedLintingShape(
          `function makeOpts() { const parserOptions = { project: './x.json' }; return parserOptions; }\nexport default [{ rules: {} }];`
        )
      ).toBeNull();
    });

    it('detects a `parserOptions` object declared separately and passed by shorthand', () => {
      expect(
        detectTypedLintingShape(
          `const parserOptions = { project: ['tsconfig.json'] };\nexport default [{ languageOptions: { parserOptions } }];`
        )
      ).toBe('parser-options-project');
    });

    it.each(['of', 'await', 'yield'])(
      'detects a setting in a file that divides a variable named `%s`',
      (name) => {
        // Contextual keywords are legal identifiers here, so `%s / 2` divides.
        expect(
          detectTypedLintingShape(
            `const ${name} = 1;\nconst ratio = ${name} / 2;\nconst marker = '//*';\nexport default [{ languageOptions: { parserOptions: { project: './tsconfig.json' } } }];\n/* end */`
          )
        ).toBe('parser-options-project');
      }
    );

    it('detects a setting below a division inside a function body', () => {
      expect(
        detectTypedLintingShape(
          `const ratio = (a) => { return a / 2; };\nexport default [{ languageOptions: { parserOptions: { projectService: true } } }];`
        )
      ).toBe('project-service');
    });

    it('ignores a key commented out after a division', () => {
      expect(
        detectTypedLintingShape(
          `const myreturn = 4;\nconst ratio = myreturn / 2; // projectService: true\nexport default [{ rules: {} }];`
        )
      ).toBeNull();
    });

    it('ignores a key commented out after a division on a member access', () => {
      expect(
        detectTypedLintingShape(
          `const ratio = counts.in / 2; // projectService: true\nexport default [{ rules: {} }];`
        )
      ).toBeNull();
    });

    it('ignores a commented-out projectService setting', () => {
      expect(
        detectTypedLintingShape(
          `// projectService: true\nexport default [{ rules: {} }];`
        )
      ).toBeNull();
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

    it('does not append when a spread config already sets parserOptions.project', () => {
      // ESLint merges parserOptions across every entry matching a file, so a
      // block appended here would sit alongside the spread config's `project`
      // and make typescript-eslint throw on every type-checked file.
      tree.write(
        'eslint.config.mjs',
        `export default [{ files: ['**/*.ts'], languageOptions: { parserOptions: { project: ['./tsconfig.json'] } } }];\n`
      );
      const original = `import baseConfig from '../../eslint.config.mjs';\nexport default [...baseConfig, { rules: {} }];\n`;
      tree.write('libs/test/eslint.config.mjs', original);

      addTypedLintingToFlatConfig(tree, 'libs/test');

      expect(tree.read('libs/test/eslint.config.mjs', 'utf-8')).toBe(original);
    });

    it('does not append when a required spread config already sets projectService', () => {
      tree.write(
        'eslint.config.cjs',
        `module.exports = [{ files: ['**/*.ts'], languageOptions: { parserOptions: { projectService: true } } }];\n`
      );
      const original = `const baseConfig = require('../../eslint.config.cjs');\nmodule.exports = [...baseConfig, { rules: {} }];\n`;
      tree.write('libs/test/eslint.config.cjs', original);

      addTypedLintingToFlatConfig(tree, 'libs/test');

      expect(tree.read('libs/test/eslint.config.cjs', 'utf-8')).toBe(original);
    });

    it('does not append when a config is spread straight from a require call', () => {
      // `...require('...')` names the module inline, with no binding to resolve.
      tree.write(
        'eslint.config.cjs',
        `module.exports = [{ files: ['**/*.ts'], languageOptions: { parserOptions: { project: ['./tsconfig.json'] } } }];\n`
      );
      const original = `module.exports = [...require('../../eslint.config.cjs'), { rules: {} }];\n`;
      tree.write('libs/test/eslint.config.cjs', original);

      addTypedLintingToFlatConfig(tree, 'libs/test');

      expect(tree.read('libs/test/eslint.config.cjs', 'utf-8')).toBe(original);
    });

    it('ignores a named export the config does not spread in', () => {
      // Only the selected export belongs to this config. `typed` may configure
      // some other project entirely, so it must not suppress the append.
      tree.write(
        'libs/shared.mjs',
        `export const base = [{ rules: {} }];\nexport const typed = [{ languageOptions: { parserOptions: { project: true } } }];\n`
      );
      tree.write(
        'libs/test/eslint.config.mjs',
        `import { base } from '../shared.mjs';\nexport default [...base, { rules: {} }];\n`
      );

      addTypedLintingToFlatConfig(tree, 'libs/test');

      expect(tree.read('libs/test/eslint.config.mjs', 'utf-8')).toContain(
        'projectService: true'
      );
    });

    it('ignores a sibling export when the config spreads the default one', () => {
      tree.write(
        'libs/shared.mjs',
        `export const typed = [{ languageOptions: { parserOptions: { project: true } } }];\nexport default [{ rules: {} }];\n`
      );
      tree.write(
        'libs/test/eslint.config.mjs',
        `import base from '../shared.mjs';\nexport default [...base, { rules: {} }];\n`
      );

      addTypedLintingToFlatConfig(tree, 'libs/test');

      expect(tree.read('libs/test/eslint.config.mjs', 'utf-8')).toContain(
        'projectService: true'
      );
    });

    it('reads typed linting from the named export the config spreads in', () => {
      tree.write(
        'libs/shared.mjs',
        `export const other = [{ rules: {} }];\nexport const base = [{ languageOptions: { parserOptions: { project: true } } }];\n`
      );
      const original = `import { base } from '../shared.mjs';\nexport default [...base, { rules: {} }];\n`;
      tree.write('libs/test/eslint.config.mjs', original);

      addTypedLintingToFlatConfig(tree, 'libs/test');

      expect(tree.read('libs/test/eslint.config.mjs', 'utf-8')).toBe(original);
    });

    it('reads both exports when the config spreads two from one module', () => {
      // Visiting `plain` must not mark the whole file as read, or `typed` never
      // gets inspected and a conflicting block is appended.
      tree.write(
        'libs/shared.mjs',
        `export const plain = [{ rules: {} }];\nexport const typed = [{ languageOptions: { parserOptions: { project: true } } }];\n`
      );
      const original = `import { plain, typed } from '../shared.mjs';\nexport default [...plain, ...typed, { rules: {} }];\n`;
      tree.write('libs/test/eslint.config.mjs', original);

      addTypedLintingToFlatConfig(tree, 'libs/test');

      expect(tree.read('libs/test/eslint.config.mjs', 'utf-8')).toBe(original);
    });

    it('follows an export that names its config instead of spelling it out', () => {
      tree.write(
        'libs/shared.mjs',
        `const base = [{ languageOptions: { parserOptions: { project: true } } }];\nexport default base;\n`
      );
      const original = `import base from '../shared.mjs';\nexport default [...base, { rules: {} }];\n`;
      tree.write('libs/test/eslint.config.mjs', original);

      addTypedLintingToFlatConfig(tree, 'libs/test');

      expect(tree.read('libs/test/eslint.config.mjs', 'utf-8')).toBe(original);
    });

    it('follows an alias chain behind an export', () => {
      tree.write(
        'libs/shared.mjs',
        `const inner = [{ languageOptions: { parserOptions: { project: true } } }];\nconst base = inner;\nexport const cfg = base;\n`
      );
      const original = `import { cfg } from '../shared.mjs';\nexport default [...cfg, { rules: {} }];\n`;
      tree.write('libs/test/eslint.config.mjs', original);

      addTypedLintingToFlatConfig(tree, 'libs/test');

      expect(tree.read('libs/test/eslint.config.mjs', 'utf-8')).toBe(original);
    });

    it('follows a named config behind `module.exports`', () => {
      tree.write(
        'libs/shared.cjs',
        `const base = [{ languageOptions: { parserOptions: { project: true } } }];\nmodule.exports = base;\n`
      );
      const original = `import base from '../shared.cjs';\nexport default [...base, { rules: {} }];\n`;
      tree.write('libs/test/eslint.config.mjs', original);

      addTypedLintingToFlatConfig(tree, 'libs/test');

      expect(tree.read('libs/test/eslint.config.mjs', 'utf-8')).toBe(original);
    });

    it('follows a local alias of a default import to its module', () => {
      tree.write(
        'libs/shared.mjs',
        `export default [{ languageOptions: { parserOptions: { project: true } } }];\n`
      );
      const original = `import base from '../shared.mjs';\nconst aliased = base;\nexport default [...aliased, { rules: {} }];\n`;
      tree.write('libs/test/eslint.config.mjs', original);

      addTypedLintingToFlatConfig(tree, 'libs/test');

      expect(tree.read('libs/test/eslint.config.mjs', 'utf-8')).toBe(original);
    });

    it('follows a local alias of a named import to its export', () => {
      tree.write(
        'libs/shared.mjs',
        `export const cfg = [{ languageOptions: { parserOptions: { project: true } } }];\n`
      );
      const original = `import { cfg } from '../shared.mjs';\nconst aliased = cfg;\nexport default [...aliased, { rules: {} }];\n`;
      tree.write('libs/test/eslint.config.mjs', original);

      addTypedLintingToFlatConfig(tree, 'libs/test');

      expect(tree.read('libs/test/eslint.config.mjs', 'utf-8')).toBe(original);
    });

    it('follows a local alias of a required config to its module', () => {
      tree.write(
        'libs/shared.cjs',
        `module.exports = [{ languageOptions: { parserOptions: { project: true } } }];\n`
      );
      const original = `const base = require('../shared.cjs');\nconst aliased = base;\nmodule.exports = [...aliased, { rules: {} }];\n`;
      tree.write('libs/test/eslint.config.cjs', original);

      addTypedLintingToFlatConfig(tree, 'libs/test');

      expect(tree.read('libs/test/eslint.config.cjs', 'utf-8')).toBe(original);
    });

    it('follows an export that hands back a config imported from elsewhere', () => {
      tree.write(
        'libs/deep.mjs',
        `export default [{ languageOptions: { parserOptions: { project: true } } }];\n`
      );
      tree.write(
        'libs/shared.mjs',
        `import inner from './deep.mjs';\nexport default inner;\n`
      );
      const original = `import base from '../shared.mjs';\nexport default [...base, { rules: {} }];\n`;
      tree.write('libs/test/eslint.config.mjs', original);

      addTypedLintingToFlatConfig(tree, 'libs/test');

      expect(tree.read('libs/test/eslint.config.mjs', 'utf-8')).toBe(original);
    });

    it('appends when the spread config configures no typed linting', () => {
      tree.write('eslint.config.mjs', `export default [{ rules: {} }];\n`);
      tree.write(
        'libs/test/eslint.config.mjs',
        `import baseConfig from '../../eslint.config.mjs';\nexport default [...baseConfig, { rules: {} }];\n`
      );

      addTypedLintingToFlatConfig(tree, 'libs/test');

      expect(tree.read('libs/test/eslint.config.mjs', 'utf-8')).toContain(
        'projectService: true'
      );
    });

    it('appends when the spread names a package rather than a workspace file', () => {
      tree.write(
        'libs/test/eslint.config.mjs',
        `import baseConfig from 'some-shared-config';\nexport default [...baseConfig, { rules: {} }];\n`
      );

      addTypedLintingToFlatConfig(tree, 'libs/test');

      expect(tree.read('libs/test/eslint.config.mjs', 'utf-8')).toContain(
        'projectService: true'
      );
    });

    it('appends when the spread config is missing from the tree', () => {
      tree.write(
        'libs/test/eslint.config.mjs',
        `import baseConfig from '../../eslint.config.mjs';\nexport default [...baseConfig, { rules: {} }];\n`
      );

      addTypedLintingToFlatConfig(tree, 'libs/test');

      expect(tree.read('libs/test/eslint.config.mjs', 'utf-8')).toContain(
        'projectService: true'
      );
    });

    it('terminates on configs that spread each other', () => {
      tree.write(
        'eslint.config.mjs',
        `import projectConfig from './libs/test/eslint.config.mjs';\nexport default [...projectConfig];\n`
      );
      tree.write(
        'libs/test/eslint.config.mjs',
        `import baseConfig from '../../eslint.config.mjs';\nexport default [...baseConfig, { rules: {} }];\n`
      );

      addTypedLintingToFlatConfig(tree, 'libs/test');

      expect(tree.read('libs/test/eslint.config.mjs', 'utf-8')).toContain(
        'projectService: true'
      );
    });
  });
});
