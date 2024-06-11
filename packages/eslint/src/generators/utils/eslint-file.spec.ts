import {
  addExtendsToLintConfig,
  findEslintFile,
  lintConfigHasOverride,
  replaceOverridesInLintConfig,
} from './eslint-file';

import { Tree, readJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  ESLINT_CONFIG_FILENAMES,
  baseEsLintConfigFile,
} from '../../utils/config-file';

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
