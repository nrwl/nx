import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { convertEslintJsonToFlatConfig } from './json-converter';

describe('convertEslintJsonToFlatConfig', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should convert root configs', async () => {
    tree.write(
      '.eslintrc.json',
      JSON.stringify({
        root: true,
        ignorePatterns: ['**/*', 'src/ignore/to/keep.ts'],
        plugins: ['@nx'],
        overrides: [
          {
            files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
            rules: {
              '@nx/enforce-module-boundaries': [
                'error',
                {
                  enforceBuildableLibDependency: true,
                  allow: [],
                  depConstraints: [
                    {
                      sourceTag: '*',
                      onlyDependOnLibsWithTags: ['*'],
                    },
                  ],
                },
              ],
            },
          },
          {
            files: ['*.ts', '*.tsx'],
            extends: ['plugin:@nx/typescript'],
            rules: {},
          },
          {
            files: [
              '**/*.spec.ts',
              '**/*.spec.tsx',
              '**/*.spec.js',
              '**/*.spec.jsx',
            ],
            env: {
              jest: true,
            },
            rules: {},
          },
        ],
      })
    );

    tree.write('.eslintignore', 'node_modules\nsomething/else');

    convertEslintJsonToFlatConfig(
      tree,
      '',
      '.eslintrc.json',
      'eslint.config.js',
      ['.eslintignore']
    );

    expect(tree.read('eslint.config.js', 'utf-8')).toMatchInlineSnapshot(`
      "const { FlatCompat } = require("@eslint/eslintrc");
      const nxEslintPlugin = require("@nx/eslint-plugin");
      const js = require("@eslint/js");
      const compat = new FlatCompat({
          baseDirectory: __dirname,
          recommendedConfig: js.configs.recommended,
      });
      module.exports = [
          { plugins: { "@nx": nxEslintPlugin } },
          {
              files: [
                  "**/*.ts",
                  "**/*.tsx",
                  "**/*.js",
                  "**/*.jsx"
              ],
              rules: { "@nx/enforce-module-boundaries": [
                      "error",
                      {
                          enforceBuildableLibDependency: true,
                          allow: [],
                          depConstraints: [{
                                  sourceTag: "*",
                                  onlyDependOnLibsWithTags: ["*"]
                              }]
                      }
                  ] }
          },
          ...compat.config({ extends: ["plugin:@nx/typescript"] }).map(config => ({
              ...config,
              files: [
                  "**/*.ts",
                  "**/*.tsx"
              ],
              rules: {}
          })),
          ...compat.config({ env: { jest: true } }).map(config => ({
              ...config,
              files: [
                  "**/*.spec.ts",
                  "**/*.spec.tsx",
                  "**/*.spec.js",
                  "**/*.spec.jsx"
              ],
              rules: {}
          })),
          { ignores: ["src/ignore/to/keep.ts"] },
          { ignores: ["something/else"] }
      ];
      "
    `);

    expect(tree.exists('.eslintrc.json')).toBeFalsy();
  });

  it('should convert project configs', async () => {
    tree.write(
      'mylib/.eslintrc.json',
      JSON.stringify({
        extends: [
          'plugin:@nx/react-typescript',
          'next',
          'next/core-web-vitals',
          '../../.eslintrc.json',
        ],
        ignorePatterns: ['!**/*', '.next/**/*'],
        overrides: [
          {
            files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
            rules: {
              '@next/next/no-html-link-for-pages': [
                'error',
                'apps/test-next/pages',
              ],
            },
          },
          {
            files: ['*.ts', '*.tsx'],
            rules: {},
          },
          {
            files: ['*.js', '*.jsx'],
            rules: {},
          },
          {
            files: ['*.json'],
            parser: 'jsonc-eslint-parser',
            rules: {
              '@nx/dependency-checks': 'error',
            },
          },
        ],
        rules: {
          '@next/next/no-html-link-for-pages': 'off',
        },
        env: {
          jest: true,
        },
      })
    );

    tree.write('mylib/.eslintignore', 'node_modules\nsomething/else');

    convertEslintJsonToFlatConfig(
      tree,
      'mylib',
      '.eslintrc.json',
      'eslint.config.js',
      ['mylib/.eslintignore']
    );

    expect(tree.read('mylib/eslint.config.js', 'utf-8')).toMatchInlineSnapshot(`
      "const { FlatCompat } = require("@eslint/eslintrc");
      const baseConfig = require("../../eslint.config.js");
      const globals = require("globals");
      const js = require("@eslint/js");
      const compat = new FlatCompat({
          baseDirectory: __dirname,
          recommendedConfig: js.configs.recommended,
      });
      module.exports = [
          ...baseConfig,
          ...compat.extends("plugin:@nx/react-typescript", "next", "next/core-web-vitals"),
          { languageOptions: { globals: { ...globals.jest } } },
          { rules: { "@next/next/no-html-link-for-pages": "off" } },
          {
              files: [
                  "mylib/**/*.ts",
                  "mylib/**/*.tsx",
                  "mylib/**/*.js",
                  "mylib/**/*.jsx"
              ],
              rules: { "@next/next/no-html-link-for-pages": [
                      "error",
                      "apps/test-next/pages"
                  ] }
          },
          {
              files: [
                  "mylib/**/*.ts",
                  "mylib/**/*.tsx"
              ],
              rules: {}
          },
          {
              files: [
                  "mylib/**/*.js",
                  "mylib/**/*.jsx"
              ],
              rules: {}
          },
          ...compat.config({ parser: "jsonc-eslint-parser" }).map(config => ({
              ...config,
              files: ["mylib/**/*.json"],
              rules: { "@nx/dependency-checks": "error" }
          })),
          { ignores: ["mylib/.next/**/*"] },
          { ignores: ["mylib/something/else"] }
      ];
      "
    `);

    expect(tree.exists('mylib/.eslintrc.json')).toBeFalsy();
  });
});
