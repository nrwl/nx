import { Tree, readJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { convertEslintJsonToFlatConfig } from './json-converter';
import { EOL } from 'node:os';

describe('convertEslintJsonToFlatConfig', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('ESM', () => {
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
              files: ['*.js', '*.jsx'],
              extends: ['plugin:@nx/javascript'],
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

      tree.write('.eslintignore', `node_modules${EOL}something/else`);

      const { content } = convertEslintJsonToFlatConfig(
        tree,
        '',
        readJson(tree, '.eslintrc.json'),
        ['.eslintignore'],
        'mjs'
      );

      expect(content).toMatchInlineSnapshot(`
        "import { FlatCompat } from "@eslint/eslintrc";
        import { dirname } from "path";
        import { fileURLToPath } from "url";
        import js from "@eslint/js";
        import nxEslintPlugin from "@nx/eslint-plugin";

        const compat = new FlatCompat({
          baseDirectory: dirname(fileURLToPath(import.meta.url)),
          recommendedConfig: js.configs.recommended,
        });


        export default [
            {
                ignores: [
                    "**/dist"
                ]
            },
            { plugins: { "@nx": nxEslintPlugin } },
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
                            allow: [],
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
            ...compat.config({
                extends: [
                    "plugin:@nx/typescript"
                ]
            }).map(config => ({
                ...config,
                files: [
                    "**/*.ts",
                    "**/*.tsx",
                    "**/*.cts",
                    "**/*.mts"
                ],
                rules: {
                    ...config.rules
                }
            })),
            ...compat.config({
                extends: [
                    "plugin:@nx/javascript"
                ]
            }).map(config => ({
                ...config,
                files: [
                    "**/*.js",
                    "**/*.jsx",
                    "**/*.cjs",
                    "**/*.mjs"
                ],
                rules: {
                    ...config.rules
                }
            })),
            ...compat.config({
                env: {
                    jest: true
                }
            }).map(config => ({
                ...config,
                files: [
                    "**/*.spec.ts",
                    "**/*.spec.tsx",
                    "**/*.spec.js",
                    "**/*.spec.jsx"
                ],
                rules: {
                    ...config.rules
                }
            })),
            {
                ignores: [
                    "src/ignore/to/keep.ts"
                ]
            },
            {
                ignores: [
                    "something/else"
                ]
            }
        ];
        "
      `);
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

      tree.write('mylib/.eslintignore', `node_modules${EOL}something/else`);

      const { content } = convertEslintJsonToFlatConfig(
        tree,
        'mylib',
        readJson(tree, 'mylib/.eslintrc.json'),
        ['mylib/.eslintignore'],
        'mjs'
      );

      expect(content).toMatchInlineSnapshot(`
              "import { FlatCompat } from "@eslint/eslintrc";
              import { dirname } from "path";
              import { fileURLToPath } from "url";
              import js from "@eslint/js";
              import baseConfig from "../../eslint.config.mjs";
              import globals from "globals";

              const compat = new FlatCompat({
                baseDirectory: dirname(fileURLToPath(import.meta.url)),
                recommendedConfig: js.configs.recommended,
              });


              export default [
                  {
                      ignores: [
                          "**/dist"
                      ]
                  },
                  ...baseConfig,
                  ...compat.extends("plugin:@nx/react-typescript", "next", "next/core-web-vitals"),
                  { languageOptions: { globals: { ...globals.jest } } },
                  {
                      rules: {
                          "@next/next/no-html-link-for-pages": "off"
                      }
                  },
                  {
                      files: [
                          "**/*.ts",
                          "**/*.tsx",
                          "**/*.js",
                          "**/*.jsx"
                      ],
                      rules: {
                          "@next/next/no-html-link-for-pages": [
                              "error",
                              "apps/test-next/pages"
                          ]
                      }
                  },
                  {
                      files: [
                          "**/*.ts",
                          "**/*.tsx"
                      ],
                      // Override or add rules here
                      rules: {}
                  },
                  {
                      files: [
                          "**/*.js",
                          "**/*.jsx"
                      ],
                      // Override or add rules here
                      rules: {}
                  },
                  {
                      files: [
                          "**/*.json"
                      ],
                      rules: {
                          "@nx/dependency-checks": "error"
                      },
                      languageOptions: {
                          parser: await import("jsonc-eslint-parser")
                      }
                  },
                  {
                      ignores: [
                          ".next/**/*"
                      ]
                  },
                  {
                      ignores: [
                          "something/else"
                      ]
                  }
              ];
              "
          `);
    });
  });

  describe('CJS', () => {
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
              files: ['*.js', '*.jsx'],
              extends: ['plugin:@nx/javascript'],
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

      tree.write('.eslintignore', `node_modules${EOL}something/else`);

      const { content } = convertEslintJsonToFlatConfig(
        tree,
        '',
        readJson(tree, '.eslintrc.json'),
        ['.eslintignore'],
        'cjs'
      );

      expect(content).toMatchInlineSnapshot(`
        "const { FlatCompat } = require("@eslint/eslintrc");
        const js = require("@eslint/js");
        const nxEslintPlugin = require("@nx/eslint-plugin");

        const compat = new FlatCompat({
          baseDirectory: __dirname,
          recommendedConfig: js.configs.recommended,
        });

        module.exports = [
            {
                ignores: [
                    "**/dist"
                ]
            },
            { plugins: { "@nx": nxEslintPlugin } },
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
                            allow: [],
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
            ...compat.config({
                extends: [
                    "plugin:@nx/typescript"
                ]
            }).map(config => ({
                ...config,
                files: [
                    "**/*.ts",
                    "**/*.tsx",
                    "**/*.cts",
                    "**/*.mts"
                ],
                rules: {
                    ...config.rules
                }
            })),
            ...compat.config({
                extends: [
                    "plugin:@nx/javascript"
                ]
            }).map(config => ({
                ...config,
                files: [
                    "**/*.js",
                    "**/*.jsx",
                    "**/*.cjs",
                    "**/*.mjs"
                ],
                rules: {
                    ...config.rules
                }
            })),
            ...compat.config({
                env: {
                    jest: true
                }
            }).map(config => ({
                ...config,
                files: [
                    "**/*.spec.ts",
                    "**/*.spec.tsx",
                    "**/*.spec.js",
                    "**/*.spec.jsx"
                ],
                rules: {
                    ...config.rules
                }
            })),
            {
                ignores: [
                    "src/ignore/to/keep.ts"
                ]
            },
            {
                ignores: [
                    "something/else"
                ]
            }
        ];
        "
      `);
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

      tree.write('mylib/.eslintignore', `node_modules${EOL}something/else`);

      const { content } = convertEslintJsonToFlatConfig(
        tree,
        'mylib',
        readJson(tree, 'mylib/.eslintrc.json'),
        ['mylib/.eslintignore'],
        'cjs'
      );

      expect(content).toMatchInlineSnapshot(`
        "const { FlatCompat } = require("@eslint/eslintrc");
        const js = require("@eslint/js");
        const baseConfig = require("../../eslint.config.cjs");
        const globals = require("globals");

        const compat = new FlatCompat({
          baseDirectory: __dirname,
          recommendedConfig: js.configs.recommended,
        });

        module.exports = [
            {
                ignores: [
                    "**/dist"
                ]
            },
            ...baseConfig,
            ...compat.extends("plugin:@nx/react-typescript", "next", "next/core-web-vitals"),
            { languageOptions: { globals: { ...globals.jest } } },
            {
                rules: {
                    "@next/next/no-html-link-for-pages": "off"
                }
            },
            {
                files: [
                    "**/*.ts",
                    "**/*.tsx",
                    "**/*.js",
                    "**/*.jsx"
                ],
                rules: {
                    "@next/next/no-html-link-for-pages": [
                        "error",
                        "apps/test-next/pages"
                    ]
                }
            },
            {
                files: [
                    "**/*.ts",
                    "**/*.tsx"
                ],
                // Override or add rules here
                rules: {}
            },
            {
                files: [
                    "**/*.js",
                    "**/*.jsx"
                ],
                // Override or add rules here
                rules: {}
            },
            {
                files: [
                    "**/*.json"
                ],
                rules: {
                    "@nx/dependency-checks": "error"
                },
                languageOptions: {
                    parser: require("jsonc-eslint-parser")
                }
            },
            {
                ignores: [
                    ".next/**/*"
                ]
            },
            {
                ignores: [
                    "something/else"
                ]
            }
        ];
        "
      `);
    });
  });
});
