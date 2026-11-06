import { Tree, joinPathFragments, logger, readJson } from '@nx/devkit';
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
        'mjs',
        new Set()
      );

      expect(content).toMatchInlineSnapshot(`
        "import { FlatCompat } from "@eslint/eslintrc";
        import { dirname } from "path";
        import { fileURLToPath } from "url";
        import js from "@eslint/js";
        import nx from "@nx/eslint-plugin";

        const compat = new FlatCompat({
          baseDirectory: dirname(fileURLToPath(import.meta.url)),
          recommendedConfig: js.configs.recommended,
        });


        const eslintConfig = [
            ...nx.configs["flat/base"],
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
            ...nx.configs["flat/typescript"],
            ...nx.configs["flat/javascript"],
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

        export default eslintConfig;
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
            browser: false,
          },
        })
      );

      tree.write('mylib/.eslintignore', `node_modules${EOL}something/else`);
      const warnSpy = vi.spyOn(logger, 'warn');

      const { content } = convertEslintJsonToFlatConfig(
        tree,
        'mylib',
        readJson(tree, 'mylib/.eslintrc.json'),
        ['mylib/.eslintignore'],
        'mjs',
        new Set([joinPathFragments('mylib', '../../.eslintrc.json')])
      );

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'The ESLint config in "mylib" disables the "browser" environment.'
        )
      );
      warnSpy.mockRestore();
      expect(content).toMatchInlineSnapshot(`
        "import { FlatCompat } from "@eslint/eslintrc";
        import { dirname } from "path";
        import { fileURLToPath } from "url";
        import js from "@eslint/js";
        import baseConfig from "../../eslint.config.mjs";
        import nx from "@nx/eslint-plugin";
        import globals from "globals";
        import jsoncEslintParser from "jsonc-eslint-parser";

        const compat = new FlatCompat({
          baseDirectory: dirname(fileURLToPath(import.meta.url)),
          recommendedConfig: js.configs.recommended,
        });


        const eslintConfig = [
            ...baseConfig,
            ...nx.configs["flat/react-typescript"],
            ...compat.extends("next", "next/core-web-vitals"),
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
                    parser: jsoncEslintParser
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

        export default eslintConfig;
        "
      `);
    });

    it('should preserve custom rules when converting Nx plugin overrides', async () => {
      tree.write(
        '.eslintrc.json',
        JSON.stringify({
          root: true,
          ignorePatterns: ['**/*'],
          plugins: ['@nx'],
          overrides: [
            {
              files: ['*.ts', '*.tsx'],
              extends: ['plugin:@nx/typescript'],
              rules: {
                '@typescript-eslint/no-unused-vars': 'error',
              },
            },
          ],
        })
      );

      const { content } = convertEslintJsonToFlatConfig(
        tree,
        '',
        readJson(tree, '.eslintrc.json'),
        [],
        'mjs',
        new Set()
      );

      expect(content).toMatchInlineSnapshot(`
        "import nx from "@nx/eslint-plugin";

        const eslintConfig = [
            ...nx.configs["flat/base"],
            ...nx.configs["flat/typescript"],
            {
                files: [
                    "**/*.ts",
                    "**/*.tsx"
                ],
                rules: {
                    "@typescript-eslint/no-unused-vars": "error"
                }
            }
        ];

        export default eslintConfig;
        "
      `);
    });

    it('names the export eslintConfig2 when an import binds eslintConfig', async () => {
      const { content } = convertEslintJsonToFlatConfig(
        tree,
        'mylib',
        { parser: 'eslint-config', rules: {} },
        [],
        'mjs',
        new Set()
      );

      expect(content).toContain(
        'import eslintConfig from "eslint-config";\n\nconst eslintConfig2 = ['
      );
      expect(content).toContain('export default eslintConfig2;');
      expect(content).not.toContain('const eslintConfig =');
    });

    it('should hand the parser of an override that needs FlatCompat to compat.config', async () => {
      // Repro for NXC-4675: an override with a parser plus a non-Nx plugin goes
      // through the FlatCompat path, which used to drop the parser entirely.
      // `env` is here on purpose: FlatCompat turns it into languageOptions.globals,
      // so re-emitting the parser onto the mapped object would wipe those globals.
      tree.write(
        '.eslintrc.json',
        JSON.stringify({
          root: true,
          overrides: [
            {
              files: ['*.ts'],
              parser: '@typescript-eslint/parser',
              parserOptions: { project: './tsconfig.json' },
              env: { node: true },
              plugins: ['@typescript-eslint'],
              rules: { '@typescript-eslint/no-explicit-any': 'error' },
            },
          ],
        })
      );

      const { content } = convertEslintJsonToFlatConfig(
        tree,
        '',
        readJson(tree, '.eslintrc.json'),
        [],
        'mjs',
        new Set()
      );

      expect(content).toMatchInlineSnapshot(`
        "import { FlatCompat } from "@eslint/eslintrc";
        import { dirname } from "path";
        import { fileURLToPath } from "url";
        import js from "@eslint/js";

        const compat = new FlatCompat({
          baseDirectory: dirname(fileURLToPath(import.meta.url)),
          recommendedConfig: js.configs.recommended,
        });


        const eslintConfig = [
            ...compat.config({
                parser: "@typescript-eslint/parser",
                parserOptions: {
                    project: "./tsconfig.json"
                },
                env: {
                    node: true
                },
                plugins: [
                    "@typescript-eslint"
                ]
            }).map(config => ({
                ...config,
                files: [
                    "**/*.ts"
                ],
                rules: {
                    ...config.rules,
                    "@typescript-eslint/no-explicit-any": "error"
                }
            }))
        ];

        export default eslintConfig;
        "
      `);
    });

    it('should preserve negated ignorePatterns paired with broader ignores', async () => {
      tree.write(
        '.eslintrc.json',
        JSON.stringify({
          root: true,
          ignorePatterns: ['**/*', 'dist/**', '!dist/keep.js', '.next/**/*'],
          plugins: ['@nx'],
        })
      );

      const { content } = convertEslintJsonToFlatConfig(
        tree,
        '',
        readJson(tree, '.eslintrc.json'),
        [],
        'mjs',
        new Set()
      );

      expect(content).toContain('"dist/**"');
      expect(content).toContain('"!dist/keep.js"');
      expect(content).toContain('".next/**/*"');
    });

    it('should rewrite extends pointing at extensionless .eslintrc', async () => {
      tree.write(
        'mylib/.eslintrc.json',
        JSON.stringify({
          extends: ['../../.eslintrc'],
          rules: {},
        })
      );

      const { content } = convertEslintJsonToFlatConfig(
        tree,
        'mylib',
        readJson(tree, 'mylib/.eslintrc.json'),
        [],
        'mjs',
        new Set([joinPathFragments('mylib', '../../.eslintrc')])
      );

      expect(content).toContain(
        'import baseConfig from "../../eslint.config.mjs"'
      );
      expect(content).toContain('...baseConfig');
      expect(content).not.toContain('compat.extends');
    });

    it('should handle overrides with mixed Nx and non-Nx extends', async () => {
      tree.write(
        '.eslintrc.json',
        JSON.stringify({
          root: true,
          ignorePatterns: ['**/*'],
          plugins: ['@nx'],
          overrides: [
            {
              files: ['*.ts', '*.tsx'],
              extends: [
                'plugin:@nx/typescript',
                'plugin:storybook/recommended',
              ],
              rules: {
                'some-rule': 'warn',
              },
            },
          ],
        })
      );

      const { content, addESLintRC } = convertEslintJsonToFlatConfig(
        tree,
        '',
        readJson(tree, '.eslintrc.json'),
        [],
        'mjs',
        new Set()
      );

      expect(addESLintRC).toBe(true);
      expect(content).toMatchInlineSnapshot(`
        "import { FlatCompat } from "@eslint/eslintrc";
        import { dirname } from "path";
        import { fileURLToPath } from "url";
        import js from "@eslint/js";
        import nx from "@nx/eslint-plugin";

        const compat = new FlatCompat({
          baseDirectory: dirname(fileURLToPath(import.meta.url)),
          recommendedConfig: js.configs.recommended,
        });


        const eslintConfig = [
            ...nx.configs["flat/base"],
            ...nx.configs["flat/typescript"],
            ...compat.config({
                extends: [
                    "plugin:storybook/recommended"
                ]
            }).map(config => ({
                ...config,
                files: [
                    "**/*.ts",
                    "**/*.tsx"
                ],
                rules: {
                    ...config.rules,
                    "some-rule": "warn"
                }
            }))
        ];

        export default eslintConfig;
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
        'cjs',
        new Set()
      );

      expect(content).toMatchInlineSnapshot(`
        "const { FlatCompat } = require("@eslint/eslintrc");
        const js = require("@eslint/js");
        const nx = require("@nx/eslint-plugin");

        const compat = new FlatCompat({
          baseDirectory: __dirname,
          recommendedConfig: js.configs.recommended,
        });

        module.exports = [
            ...nx.configs["flat/base"],
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
            ...nx.configs["flat/typescript"],
            ...nx.configs["flat/javascript"],
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
        'cjs',
        new Set([joinPathFragments('mylib', '../../.eslintrc.json')])
      );

      expect(content).toMatchInlineSnapshot(`
        "const { FlatCompat } = require("@eslint/eslintrc");
        const js = require("@eslint/js");
        const baseConfig = require("../../eslint.config.cjs");
        const nx = require("@nx/eslint-plugin");
        const globals = require("globals");

        const compat = new FlatCompat({
          baseDirectory: __dirname,
          recommendedConfig: js.configs.recommended,
        });

        module.exports = [
            ...baseConfig,
            ...nx.configs["flat/react-typescript"],
            ...compat.extends("next", "next/core-web-vitals"),
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

    it('should hand the parser of an override that needs FlatCompat to compat.config', async () => {
      // Repro for NXC-4675 (cjs): an override with a parser plus a non-Nx plugin
      // goes through the FlatCompat path, which used to drop the parser entirely.
      tree.write(
        '.eslintrc.json',
        JSON.stringify({
          root: true,
          overrides: [
            {
              files: ['*.ts'],
              parser: '@typescript-eslint/parser',
              parserOptions: { project: './tsconfig.json' },
              env: { node: true },
              plugins: ['@typescript-eslint'],
              rules: { '@typescript-eslint/no-explicit-any': 'error' },
            },
          ],
        })
      );

      const { content } = convertEslintJsonToFlatConfig(
        tree,
        '',
        readJson(tree, '.eslintrc.json'),
        [],
        'cjs',
        new Set()
      );

      expect(content).toMatchInlineSnapshot(`
        "const { FlatCompat } = require("@eslint/eslintrc");
        const js = require("@eslint/js");

        const compat = new FlatCompat({
          baseDirectory: __dirname,
          recommendedConfig: js.configs.recommended,
        });

        module.exports = [
            ...compat.config({
                parser: "@typescript-eslint/parser",
                parserOptions: {
                    project: "./tsconfig.json"
                },
                env: {
                    node: true
                },
                plugins: [
                    "@typescript-eslint"
                ]
            }).map(config => ({
                ...config,
                files: [
                    "**/*.ts"
                ],
                rules: {
                    ...config.rules,
                    "@typescript-eslint/no-explicit-any": "error"
                }
            }))
        ];
        "
      `);
    });
  });
});
