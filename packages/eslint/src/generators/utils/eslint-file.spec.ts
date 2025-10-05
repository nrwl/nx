import { readJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import * as devkitInternals from 'nx/src/devkit-internals';
import {
  BASE_ESLINT_CONFIG_FILENAMES,
  ESLINT_CONFIG_FILENAMES,
} from '../../utils/config-file';
import {
  addExtendsToLintConfig,
  addIgnoresToLintConfig,
  findEslintFile,
  lintConfigHasOverride,
  replaceOverridesInLintConfig,
} from './eslint-file';

describe('@nx/eslint:lint-file', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
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
      // mock eslint version
      jest.spyOn(devkitInternals, 'readModulePackageJson').mockReturnValue({
        packageJson: { name: 'eslint', version: '9.0.0' },
        path: '',
      });
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
          "@eslint/eslintrc": "^2.1.1",
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
      // mock eslint version
      jest.spyOn(devkitInternals, 'readModulePackageJson').mockReturnValue({
        packageJson: { name: 'eslint', version: '9.0.0' },
        path: '',
      });
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
      // mock eslint version
      jest.spyOn(devkitInternals, 'readModulePackageJson').mockReturnValue({
        packageJson: { name: 'eslint', version: '9.0.0' },
        path: '',
      });
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

    it('should not add wrapped plugin for compat in extends when not using eslint v9', () => {
      // mock eslint version
      jest.spyOn(devkitInternals, 'readModulePackageJson').mockReturnValue({
        packageJson: { name: 'eslint', version: '8.0.0' },
        path: '',
      });
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
});
