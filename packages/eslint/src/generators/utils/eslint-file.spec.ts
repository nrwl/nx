import { readJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import * as devkitInternals from 'nx/src/devkit-internals';
import {
  ESLINT_CONFIG_FILENAMES,
  baseEsLintConfigFile,
} from '../../utils/config-file';
import {
  addExtendsToLintConfig,
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

    test.each(ESLINT_CONFIG_FILENAMES)(
      'should return base file instead %p when calling findEslintFile',
      (eslintFileName) => {
        tree.write(baseEsLintConfigFile, '{}');
        tree.write(eslintFileName, '{}');
        expect(findEslintFile(tree)).toBe(baseEsLintConfigFile);
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

    it('should add extends to flat config', () => {
      tree.write('eslint.config.js', 'module.exports = {};');
      tree.write(
        'apps/demo/eslint.config.js',
        `const baseConfig = require("../../eslint.config.js");

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

      expect(tree.read('apps/demo/eslint.config.js', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { FlatCompat } = require("@eslint/eslintrc");
        const js = require("@eslint/js");
        const baseConfig = require("../../eslint.config.js");

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
      tree.write('eslint.config.js', 'module.exports = {};');
      tree.write(
        'apps/demo/eslint.config.js',
        `const baseConfig = require("../../eslint.config.js");

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

      expect(tree.read('apps/demo/eslint.config.js', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { FlatCompat } = require("@eslint/eslintrc");
        const js = require("@eslint/js");
        const { fixupConfigRules } = require("@eslint/compat");
        const baseConfig = require("../../eslint.config.js");

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
      tree.write('eslint.config.js', 'module.exports = {};');
      tree.write(
        'apps/demo/eslint.config.js',
        `const baseConfig = require("../../eslint.config.js");

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

      expect(tree.read('apps/demo/eslint.config.js', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { FlatCompat } = require("@eslint/eslintrc");
        const js = require("@eslint/js");
        const { fixupConfigRules } = require("@eslint/compat");
        const baseConfig = require("../../eslint.config.js");

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
      tree.write('eslint.config.js', 'module.exports = {};');
      tree.write(
        'apps/demo/eslint.config.js',
        `const baseConfig = require("../../eslint.config.js");

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

      expect(tree.read('apps/demo/eslint.config.js', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { FlatCompat } = require("@eslint/eslintrc");
        const js = require("@eslint/js");
        const baseConfig = require("../../eslint.config.js");

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
      tree.write('eslint.config.js', 'module.exports = {};');
      tree.write(
        'apps/demo/eslint.config.js',
        `const baseConfig = require("../../eslint.config.js");

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

      expect(tree.read('apps/demo/eslint.config.js', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { FlatCompat } = require("@eslint/eslintrc");
        const js = require("@eslint/js");
        const baseConfig = require("../../eslint.config.js");

        const compat = new FlatCompat({
          baseDirectory: __dirname,
          recommendedConfig: js.configs.recommended,
        });

        module.exports = [
          ...baseConfig,
            ...compat.config({ extends: [
                    "plugin:@nx/angular",
                    "plugin:@angular-eslint/template/process-inline-templates"
                ] }).map(config => ({
                ...config,
                files: ["**/*.ts"],
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
            ...compat.config({ extends: ["plugin:@nx/angular-template"] }).map(config => ({
                ...config,
                files: ["**/*.html"],
                rules: {
                    ...config.rules
                }
            })),
        ];"
      `);
    });
  });
});
