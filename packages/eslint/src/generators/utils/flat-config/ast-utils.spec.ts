import ts = require('typescript');
import {
  addBlockToFlatConfigExport,
  addFlatCompatToFlatConfig,
  addImportToFlatConfig,
  generateAst,
  generateFlatOverride,
  generatePluginExtendsElementWithCompatFixup,
  removeCompatExtends,
  removeImportFromFlatConfig,
  removeOverridesFromLintConfig,
  removePlugin,
  removePredefinedConfigs,
  replaceOverride,
} from './ast-utils';
import { stripIndents } from '@nx/devkit';

describe('ast-utils', () => {
  const printer = ts.createPrinter();

  function printTsNode(node: ts.Node) {
    return printer.printNode(
      ts.EmitHint.Unspecified,
      node,
      ts.createSourceFile('test.ts', '', ts.ScriptTarget.Latest)
    );
  }

  describe('generateFlatOverride', () => {
    it('should create appropriate ASTs for a flat config entries based on the provided legacy eslintrc JSON override data', () => {
      // It's easier to review the stringified result of the AST than the AST itself
      const getOutput = (input: any) => {
        const ast = generateFlatOverride(input, 'mjs');
        return printTsNode(ast);
      };

      expect(getOutput({})).toMatchInlineSnapshot(`"{}"`);

      // It should apply rules directly
      expect(
        getOutput({
          rules: {
            a: 'error',
            b: 'off',
            c: [
              'error',
              {
                some: {
                  rich: ['config', 'options'],
                },
              },
            ],
          },
        })
      ).toMatchInlineSnapshot(`
        "{
            rules: {
                a: "error",
                b: "off",
                c: [
                    "error",
                    {
                        some: {
                            rich: [
                                "config",
                                "options"
                            ]
                        }
                    }
                ]
            }
        }"
      `);

      // It should normalize and apply files as an array
      expect(
        getOutput({
          files: '*.ts', //  old single * syntax should be replaced by **/*
        })
      ).toMatchInlineSnapshot(`
        "{
            files: [
                "**/*.ts"
            ]
        }"
      `);

      expect(
        getOutput({
          // It should not only nest the parser in languageOptions, but also wrap it in an import call because parsers are passed by reference in flat config
          parser: 'jsonc-eslint-parser',
        })
      ).toMatchInlineSnapshot(`
        "{
            languageOptions: {
                parser: await import("jsonc-eslint-parser")
            }
        }"
      `);

      expect(
        getOutput({
          // It should nest parserOptions in languageOptions
          parserOptions: {
            foo: 'bar',
          },
        })
      ).toMatchInlineSnapshot(`
        "{
            languageOptions: {
                parserOptions: {
                    foo: "bar"
                }
            }
        }"
      `);

      // It should add the compat tooling for extends, and spread the rules object to allow for easier editing by users
      expect(getOutput({ extends: ['plugin:@nx/typescript'] }))
        .toMatchInlineSnapshot(`
        "...compat.config({
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
        }))"
      `);

      // It should add the compat tooling for plugins, and spread the rules object to allow for easier editing by users
      expect(getOutput({ plugins: ['@nx/eslint-plugin'] }))
        .toMatchInlineSnapshot(`
        "...compat.config({
            plugins: [
                "@nx/eslint-plugin"
            ]
        }).map(config => ({
            ...config,
            rules: {
                ...config.rules
            }
        }))"
      `);

      // It should add the compat tooling for env, and spread the rules object to allow for easier editing by users
      expect(getOutput({ env: { jest: true } })).toMatchInlineSnapshot(`
        "...compat.config({
            env: {
                jest: true
            }
        }).map(config => ({
            ...config,
            rules: {
                ...config.rules
            }
        }))"
      `);

      // Files for the compat tooling should be added appropriately
      expect(getOutput({ env: { jest: true }, files: ['*.ts', '*.tsx'] }))
        .toMatchInlineSnapshot(`
        "...compat.config({
            env: {
                jest: true
            }
        }).map(config => ({
            ...config,
            files: [
                "**/*.ts",
                "**/*.tsx"
            ],
            rules: {
                ...config.rules
            }
        }))"
      `);
    });
  });

  describe('addBlockToFlatConfigExport', () => {
    it('should inject block to the end of the file', () => {
      const content = `import baseConfig from "../../eslint.config.mjs";
    export default [
        ...baseConfig,
        {
            files: [
                "my-lib/**/*.ts",
                "my-lib/**/*.tsx"
            ],
            rules: {}
        },
        { ignores: ["my-lib/.cache/**/*"] },
    ];`;
      const result = addBlockToFlatConfigExport(
        content,
        generateAst({
          files: ['**/*.svg'],
          rules: {
            '@nx/do-something-with-svg': 'error',
          },
        })
      );
      expect(result).toMatchInlineSnapshot(`
        "import baseConfig from "../../eslint.config.mjs";

        export default [
            ...baseConfig,
            {
                files: [
                    "my-lib/**/*.ts",
                    "my-lib/**/*.tsx"
                ],
                rules: {}
            },
            { ignores: ["my-lib/.cache/**/*"] },
            {
                files: [
                    "**/*.svg"
                ],
                rules: {
                    "@nx/do-something-with-svg": "error"
                }
            }
        ];
        "
      `);
    });

    it('should inject spread to the beginning of the file', () => {
      const content = `import baseConfig from "../../eslint.config.mjs";
    export default [
        ...baseConfig,
        {
            files: [
                "my-lib/**/*.ts",
                "my-lib/**/*.tsx"
            ],
            rules: {}
        },
        { ignores: ["my-lib/.cache/**/*"] },
    ];`;
      const result = addBlockToFlatConfigExport(
        content,
        ts.factory.createSpreadElement(ts.factory.createIdentifier('config')),
        { insertAtTheEnd: false }
      );
      expect(result).toMatchInlineSnapshot(`
        "import baseConfig from "../../eslint.config.mjs";

        export default [
            ...config,
            ...baseConfig,
            {
                files: [
                    "my-lib/**/*.ts",
                    "my-lib/**/*.tsx"
                ],
                rules: {}
            },
            { ignores: ["my-lib/.cache/**/*"] }
        ];
        "
      `);
    });
  });

  describe('addImportToFlatConfig', () => {
    it('should inject import if not found', () => {
      const content = `import baseConfig from "../../eslint.config.mjs";
    export default [
        ...baseConfig,
        {
            files: [
                "my-lib/**/*.ts",
                "my-lib/**/*.tsx"
            ],
            rules: {}
        },
        { ignores: ["my-lib/.cache/**/*"] },
    ];`;
      const result = addImportToFlatConfig(
        content,
        ['varName'],
        '@myorg/awesome-config'
      );
      expect(result).toMatchInlineSnapshot(`
        "import { varName } from "@myorg/awesome-config";
        import baseConfig from "../../eslint.config.mjs";
            export default [
                ...baseConfig,
                {
                    files: [
                        "my-lib/**/*.ts",
                        "my-lib/**/*.tsx"
                    ],
                    rules: {}
                },
                { ignores: ["my-lib/.cache/**/*"] },
            ];"
      `);
    });

    it('should update import if already found', () => {
      const content = `import { varName } from "@myorg/awesome-config";
    import baseConfig from "../../eslint.config.mjs";
    export default [
        ...baseConfig,
        {
            files: [
                "my-lib/**/*.ts",
                "my-lib/**/*.tsx"
            ],
            rules: {}
        },
        { ignores: ["my-lib/.cache/**/*"] },
    ];`;
      const result = addImportToFlatConfig(
        content,
        ['otherName', 'someName'],
        '@myorg/awesome-config'
      );
      expect(result).toMatchInlineSnapshot(`
        "import { varName,  otherName, someName  } from "@myorg/awesome-config";
            import baseConfig from "../../eslint.config.mjs";
            export default [
                ...baseConfig,
                {
                    files: [
                        "my-lib/**/*.ts",
                        "my-lib/**/*.tsx"
                    ],
                    rules: {}
                },
                { ignores: ["my-lib/.cache/**/*"] },
            ];"
      `);
    });

    it('should not inject import if already exists', () => {
      const content = `import { varName, otherName } from "@myorg/awesome-config";
    import baseConfig from "../../eslint.config.mjs";

    export default [
        ...baseConfig,
        {
            files: [
                "my-lib/**/*.ts",
                "my-lib/**/*.tsx"
            ],
            rules: {}
        },
        { ignores: ["my-lib/.cache/**/*"] },
    ];`;
      const result = addImportToFlatConfig(
        content,
        ['otherName'],
        '@myorg/awesome-config'
      );
      expect(result).toEqual(content);
    });

    it('should not update import if already exists', () => {
      const content = `import { varName } from "@myorg/awesome-config";
    import baseConfig from "../../eslint.config.mjs";

    export default [
        ...baseConfig,
        {
            files: [
                "my-lib/**/*.ts",
                "my-lib/**/*.tsx"
            ],
            rules: {}
        },
        { ignores: ["my-lib/.cache/**/*"] },
    ];`;
      const result = addImportToFlatConfig(
        content,
        ['varName'],
        '@myorg/awesome-config'
      );
      expect(result).toEqual(content);
    });
  });

  describe('removeImportFromFlatConfig', () => {
    it('should remove existing import from config if the var name matches', () => {
      const content = stripIndents`
        import nx from "@nx/eslint-plugin";
        import thisShouldRemain from "@nx/eslint-plugin";
        import playwright from 'eslint-plugin-playwright';

        export default [
          playwright.configs['flat/recommended'],
        ];
      `;
      const result = removeImportFromFlatConfig(
        content,
        'nx',
        '@nx/eslint-plugin'
      );
      expect(result).toMatchInlineSnapshot(`
        "
        import thisShouldRemain from "@nx/eslint-plugin";
        import playwright from 'eslint-plugin-playwright';

        export default [
        playwright.configs['flat/recommended'],
        ];"
      `);
    });
  });

  describe('addCompatToFlatConfig', () => {
    it('should add compat to config', () => {
      const content = `import baseConfig from "../../eslint.config.mjs";
    export default [
      ...baseConfig,
      {
        files: [
          "my-lib/**/*.ts",
          "my-lib/**/*.tsx"
        ],
        rules: {}
      },
      { ignores: ["my-lib/.cache/**/*"] },
    ];`;
      const result = addFlatCompatToFlatConfig(content);
      expect(result).toMatchInlineSnapshot(`
        "import { FlatCompat } from "@eslint/eslintrc";
        import { dirname } from "path";
        import { fileURLToPath } from "url";
        import js from "@eslint/js";
        import baseConfig from "../../eslint.config.mjs";
           
        const compat = new FlatCompat({
          baseDirectory: dirname(fileURLToPath(import.meta.url)),
          recommendedConfig: js.configs.recommended,
        });

         export default [
              ...baseConfig,
              {
                files: [
                  "my-lib/**/*.ts",
                  "my-lib/**/*.tsx"
                ],
                rules: {}
              },
              { ignores: ["my-lib/.cache/**/*"] },
            ];"
      `);
    });

    it('should add only partially compat to config if parts exist', () => {
      const content = `import baseConfig from "../../eslint.config.mjs";
import js from "@eslint/js";

    export default [
      ...baseConfig,
      {
        files: [
          "my-lib/**/*.ts",
          "my-lib/**/*.tsx"
        ],
        rules: {}
      },
      { ignores: ["my-lib/.cache/**/*"] },
    ];`;
      const result = addFlatCompatToFlatConfig(content);
      expect(result).toMatchInlineSnapshot(`
        "import { FlatCompat } from "@eslint/eslintrc";
        import { dirname } from "path";
        import { fileURLToPath } from "url";
        import baseConfig from "../../eslint.config.mjs";
        import js from "@eslint/js";

           
        const compat = new FlatCompat({
          baseDirectory: dirname(fileURLToPath(import.meta.url)),
          recommendedConfig: js.configs.recommended,
        });

         export default [
              ...baseConfig,
              {
                files: [
                  "my-lib/**/*.ts",
                  "my-lib/**/*.tsx"
                ],
                rules: {}
              },
              { ignores: ["my-lib/.cache/**/*"] },
            ];"
      `);
    });

    it('should not add compat to config if exist', () => {
      const content = `import { FlatCompat } from "@eslint/eslintrc";
    import baseConfig from "../../eslint.config.cjs";
    import js from "@eslint/js";
    import { fileURLToPath } from "url";
    import { dirname } from 'path';

    const compat = new FlatCompat({
      baseDirectory: dirname(fileURLToPath(import.meta.url)),
      recommendedConfig: js.configs.recommended,
    });

    export default [
      ...baseConfig,
      {
        files: [
          "my-lib/**/*.ts",
          "my-lib/**/*.tsx"
        ],
        rules: {}
      },
      { ignores: ["my-lib/.cache/**/*"] },
    ];`;
      const result = addFlatCompatToFlatConfig(content);
      expect(result).toEqual(content);
    });
  });

  describe('removeOverridesFromLintConfig', () => {
    it('should remove all rules from config', () => {
      const content = `import { FlatCompat } from "@eslint/eslintrc";
      import js from "@eslint/js";
      import { fileURLToPath } from "url";
      import { dirname } from 'path';

    const compat = new FlatCompat({
      baseDirectory: dirname(fileURLToPath(import.meta.url)),
      recommendedConfig: js.configs.recommended,
    });

    export default [
      ...baseConfig,
      {
        files: [
          "my-lib/**/*.ts",
          "my-lib/**/*.tsx"
        ],
        rules: {}
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
      { ignores: ["my-lib/.cache/**/*"] },
    ];`;
      const result = removeOverridesFromLintConfig(content);
      expect(result).toMatchInlineSnapshot(`
        "import { FlatCompat } from "@eslint/eslintrc";
              import js from "@eslint/js";
              import { fileURLToPath } from "url";
              import { dirname } from 'path';

            const compat = new FlatCompat({
              baseDirectory: dirname(fileURLToPath(import.meta.url)),
              recommendedConfig: js.configs.recommended,
            });

            export default [
              ...baseConfig,
              { ignores: ["my-lib/.cache/**/*"] },
            ];"
      `);
    });

    it('should remove all rules from starting with first', () => {
      const content = `import baseConfig from "../../eslint.config.mjs";

    export default [
      {
        files: [
          "my-lib/**/*.ts",
          "my-lib/**/*.tsx"
        ],
        rules: {}
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
      }))
    ];`;
      const result = removeOverridesFromLintConfig(content);
      expect(result).toMatchInlineSnapshot(`
        "import baseConfig from "../../eslint.config.mjs";

            export default [
            ];"
      `);
    });
  });

  describe('replaceOverride', () => {
    it('should find and replace rules in override', () => {
      const content = `import baseConfig from "../../eslint.config.mjs";

export default [
    {
        files: [
            "my-lib/**/*.ts",
            "my-lib/**/*.tsx"
        ],
        rules: {
            'my-ts-rule': 'error'
        }
    },
    {
        files: [
            "my-lib/**/*.ts",
            "my-lib/**/*.js"
        ],
        rules: {}
    },
    {
        files: [
            "my-lib/**/*.js",
            "my-lib/**/*.jsx"
        ],
        rules: {
            'my-js-rule': 'error'
        }
    },
];`;

      const result = replaceOverride(
        content,
        'my-lib',
        (o) => o.files.includes('my-lib/**/*.ts'),
        (o) => ({
          ...o,
          rules: {
            'my-rule': 'error',
          },
        })
      );
      expect(result).toMatchInlineSnapshot(`
        "import baseConfig from "../../eslint.config.mjs";

        export default [
            {
              "files": [
                "my-lib/**/*.ts",
                "my-lib/**/*.tsx"
              ],
              "rules": {
                "my-rule": "error"
              }
            },
            {
              "files": [
                "my-lib/**/*.ts",
                "my-lib/**/*.js"
              ],
              "rules": {
                "my-rule": "error"
              }
            },
            {
                files: [
                    "my-lib/**/*.js",
                    "my-lib/**/*.jsx"
                ],
                rules: {
                    'my-js-rule': 'error'
                }
            },
        ];"
      `);
    });

    it('should append rules in override', () => {
      const content = `import baseConfig from "../../eslint.config.mjs";

export default [
    {
        files: [
            "my-lib/**/*.ts",
            "my-lib/**/*.tsx"
        ],
        rules: {
            'my-ts-rule': 'error'
        }
    },
    {
        files: [
            "my-lib/**/*.js",
            "my-lib/**/*.jsx"
        ],
        rules: {
            'my-js-rule': 'error'
        }
    },
];`;

      const result = replaceOverride(
        content,
        'my-lib',
        (o) => o.files.includes('my-lib/**/*.ts'),
        (o) => ({
          ...o,
          rules: {
            ...o.rules,
            'my-new-rule': 'error',
          },
        })
      );
      expect(result).toMatchInlineSnapshot(`
        "import baseConfig from "../../eslint.config.mjs";

        export default [
            {
              "files": [
                "my-lib/**/*.ts",
                "my-lib/**/*.tsx"
              ],
              "rules": {
                "my-ts-rule": "error",
                "my-new-rule": "error"
              }
            },
            {
                files: [
                    "my-lib/**/*.js",
                    "my-lib/**/*.jsx"
                ],
                rules: {
                    'my-js-rule': 'error'
                }
            },
        ];"
      `);
    });

    it('should work for compat overrides', () => {
      const content = `import baseConfig from "../../eslint.config.mjs";

export default [
    ...compat.config({ extends: ["plugin:@nx/typescript"] }).map(config => ({
    ...config,
    files: [
        "my-lib/**/*.ts",
        "my-lib/**/*.tsx"
    ],
    rules: {
        'my-ts-rule': 'error'
    }
  }),
];`;

      const result = replaceOverride(
        content,
        'my-lib',
        (o) => o.files.includes('my-lib/**/*.ts'),
        (o) => ({
          ...o,
          rules: {
            ...o.rules,
            'my-new-rule': 'error',
          },
        })
      );
      expect(result).toMatchInlineSnapshot(`
        "import baseConfig from "../../eslint.config.mjs";

        export default [
            ...compat.config({ extends: ["plugin:@nx/typescript"] }).map(config => ({
            ...config,
              "files": [
                "my-lib/**/*.ts",
                "my-lib/**/*.tsx"
              ],
              "rules": {
                "my-ts-rule": "error",
                "my-new-rule": "error"
              }
          }),
        ];"
      `);
    });
  });

  describe('removePlugin', () => {
    it('should remove plugins from config', () => {
      const content = `import { FlatCompat } from "@eslint/eslintrc";
      import nxEslintPlugin from "@nx/eslint-plugin";
      import js = from ("@eslint/js");
      import { fileURLToPath} from "url";
      import { dirname } from 'path';

      const compat = new FlatCompat({
        baseDirectory: dirname(fileURLToPath(import.meta.url));
        recommendedConfig: js.configs.recommended,
      });
      export default [
        { plugins: { "@nx": nxEslintPlugin } },
        { ignores: ["src/ignore/to/keep.ts"] },
        { ignores: ["something/else"] }
      ];`;

      const result = removePlugin(content, '@nx', '@nx/eslint-plugin');
      expect(result).toMatchInlineSnapshot(`
        "import { FlatCompat } from "@eslint/eslintrc";
              import js = from ("@eslint/js");
              import { fileURLToPath} from "url";
              import { dirname } from 'path';

              const compat = new FlatCompat({
                baseDirectory: dirname(fileURLToPath(import.meta.url));
                recommendedConfig: js.configs.recommended,
              });
              export default [
                { ignores: ["src/ignore/to/keep.ts"] },
                { ignores: ["something/else"] }
              ];"
      `);
    });

    it('should remove single plugin from config', () => {
      const content = `import { FlatCompat } from "@eslint/eslintrc";
      import nxEslintPlugin from "@nx/eslint-plugin";
      import otherPlugin from "other/eslint-plugin";
      import js from "@eslint/js";
      import { fileURLToPath } from "url";
      import { dirname } from 'path';

      const compat = new FlatCompat({
        baseDirectory: dirname(fileURLToPath(import.meta.url)),
        recommendedConfig: js.configs.recommended,
      });

      export default [
        { plugins: { "@nx": nxEslintPlugin, "@other": otherPlugin } },
        { ignores: ["src/ignore/to/keep.ts"] },
        { ignores: ["something/else"] }
      ];`;

      const result = removePlugin(content, '@nx', '@nx/eslint-plugin');
      expect(result).toMatchInlineSnapshot(`
        "import { FlatCompat } from "@eslint/eslintrc";
              import otherPlugin from "other/eslint-plugin";
              import js from "@eslint/js";
              import { fileURLToPath } from "url";
              import { dirname } from 'path';

              const compat = new FlatCompat({
                baseDirectory: dirname(fileURLToPath(import.meta.url)),
                recommendedConfig: js.configs.recommended,
              });

              export default [
                { plugins: { "@other": otherPlugin } },
                { ignores: ["src/ignore/to/keep.ts"] },
                { ignores: ["something/else"] }
              ];"
      `);
    });

    it('should leave other properties in config', () => {
      const content = `import { FlatCompat } from "@eslint/eslintrc";
      import nxEslintPlugin from "@nx/eslint-plugin";
      import js from "@eslint/js";
      import { fileURLToPath } from "url";
      import { dirname } from 'path';

      const compat = new FlatCompat({
        baseDirectory: dirname(fileURLToPath(import.meta.url)),
        recommendedConfig: js.configs.recommended,
      });

      export default [
        { plugins: { "@nx": nxEslintPlugin }, rules: {} },
        { ignores: ["src/ignore/to/keep.ts"] },
        { ignores: ["something/else"] }
      ];`;

      const result = removePlugin(content, '@nx', '@nx/eslint-plugin');
      expect(result).toMatchInlineSnapshot(`
        "import { FlatCompat } from "@eslint/eslintrc";
              import js from "@eslint/js";
              import { fileURLToPath } from "url";
              import { dirname } from 'path';

              const compat = new FlatCompat({
                baseDirectory: dirname(fileURLToPath(import.meta.url)),
                recommendedConfig: js.configs.recommended,
              });

              export default [
                { rules: {} },
                { ignores: ["src/ignore/to/keep.ts"] },
                { ignores: ["something/else"] }
              ];"
      `);
    });

    it('should remove single plugin from config array', () => {
      const content = `import { FlatCompat } from "@eslint/eslintrc";
      import nxEslintPlugin from "@nx/eslint-plugin";
      import js from "@eslint/js";
      import { fileURLToPath } from "url";
      import { dirname } from 'path';

      const compat = new FlatCompat({
        baseDirectory: dirname(fileURLToPath(import.meta.url)),
        recommendedConfig: js.configs.recommended,
      });

      export default [
        { plugins: ["@nx", "something-else"] },
        { ignores: ["src/ignore/to/keep.ts"] },
        { ignores: ["something/else"] }
      ];`;

      const result = removePlugin(content, '@nx', '@nx/eslint-plugin');
      expect(result).toMatchInlineSnapshot(`
        "import { FlatCompat } from "@eslint/eslintrc";
              import js from "@eslint/js";
              import { fileURLToPath } from "url";
              import { dirname } from 'path';

              const compat = new FlatCompat({
                baseDirectory: dirname(fileURLToPath(import.meta.url)),
                recommendedConfig: js.configs.recommended,
              });

              export default [
                { plugins:["something-else"] },
                { ignores: ["src/ignore/to/keep.ts"] },
                { ignores: ["something/else"] }
              ];"
      `);
    });

    it('should leave other fields in the object', () => {
      const content = `import { FlatCompat } from "@eslint/eslintrc";
      import nxEslintPlugin from "@nx/eslint-plugin";
      import js from "@eslint/js";
      import { fileURLToPath } from "url";
      import { dirname } from 'path';

      const compat = new FlatCompat({
        baseDirectory: dirname(fileURLToPath(import.meta.url)),
        recommendedConfig: js.configs.recommended,
      });

      export default [
        { plugins: ["@nx"], rules: { } },
        { ignores: ["src/ignore/to/keep.ts"] },
        { ignores: ["something/else"] }
      ];`;

      const result = removePlugin(content, '@nx', '@nx/eslint-plugin');
      expect(result).toMatchInlineSnapshot(`
        "import { FlatCompat } from "@eslint/eslintrc";
              import js from "@eslint/js";
              import { fileURLToPath } from "url";
              import { dirname } from 'path';

              const compat = new FlatCompat({
                baseDirectory: dirname(fileURLToPath(import.meta.url)),
                recommendedConfig: js.configs.recommended,
              });

              export default [
                { rules: { } },
                { ignores: ["src/ignore/to/keep.ts"] },
                { ignores: ["something/else"] }
              ];"
      `);
    });

    it('should remove entire plugin when array with single element', () => {
      const content = `import { FlatCompat } from "@eslint/eslintrc";
      import nxEslintPlugin from "@nx/eslint-plugin";
      import js from "@eslint/js";

      import { fileURLToPath } from "url";
      import { dirname } from 'path';

      const compat = new FlatCompat({
        baseDirectory: dirname(fileURLToPath(import.meta.url)),
        recommendedConfig: js.configs.recommended,
      });

      export default [
        { plugins: ["@nx"] },
        { ignores: ["src/ignore/to/keep.ts"] },
        { ignores: ["something/else"] }
      ];`;

      const result = removePlugin(content, '@nx', '@nx/eslint-plugin');
      expect(result).toMatchInlineSnapshot(`
        "import { FlatCompat } from "@eslint/eslintrc";
              import js from "@eslint/js";

              import { fileURLToPath } from "url";
              import { dirname } from 'path';

              const compat = new FlatCompat({
                baseDirectory: dirname(fileURLToPath(import.meta.url)),
                recommendedConfig: js.configs.recommended,
              });

              export default [
                { ignores: ["src/ignore/to/keep.ts"] },
                { ignores: ["something/else"] }
              ];"
      `);
    });
  });

  describe('removeCompatExtends', () => {
    it('should remove compat extends from config', () => {
      const content = `import { FlatCompat } from "@eslint/eslintrc";
      import nxEslintPlugin from "@nx/eslint-plugin";
      import js from "@eslint/js";
      import { fileURLToPath } from "url";
      import { dirname } from "path";

      const compat = new FlatCompat({
        baseDirectory: dirname(fileURLToPath(import.meta.url)),
        recommendedConfig: js.configs.recommended,
      });

      export default [
        { plugins: { "@nx": nxEslintPlugin } },
        ...compat.config({ extends: ["plugin:@nx/typescript"] }).map(config => ({
          ...config,
          files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
          rules: {}
        })),
        { ignores: ["src/ignore/to/keep.ts"] },
        ...compat.config({ extends: ["plugin:@nx/javascript"] }).map(config => ({
          files: ['*.js', '*.jsx'],
          ...config,
          rules: {}
        }))
      ];`;

      const result = removeCompatExtends(content, [
        'plugin:@nx/typescript',
        'plugin:@nx/javascript',
      ]);
      expect(result).toMatchInlineSnapshot(`
        "import { FlatCompat } from "@eslint/eslintrc";
              import nxEslintPlugin from "@nx/eslint-plugin";
              import js from "@eslint/js";
              import { fileURLToPath } from "url";
              import { dirname } from "path";

              const compat = new FlatCompat({
                baseDirectory: dirname(fileURLToPath(import.meta.url)),
                recommendedConfig: js.configs.recommended,
              });

              export default [
                { plugins: { "@nx": nxEslintPlugin } },
        {
                 files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
                  rules: {}
                },
                { ignores: ["src/ignore/to/keep.ts"] },
        {
                  files: ['*.js', '*.jsx'],
                 rules: {}
                }
              ];"
      `);
    });
  });

  describe('removePredefinedConfigs', () => {
    it('should remove config objects and import', () => {
      const content = stripIndents`
        import nx from "@nx/eslint-plugin";
        import playwright from 'eslint-plugin-playwright';

        export default [
          ...nx.config['flat/base'],
          ...nx.config['flat/typescript'],
          ...nx.config['flat/javascript'],
          playwright.configs['flat/recommended'],
        ];
      `;

      const result = removePredefinedConfigs(
        content,
        '@nx/eslint-plugin',
        'nx',
        ['flat/base', 'flat/typescript', 'flat/javascript']
      );

      expect(result).toMatchInlineSnapshot(`
        "
        import playwright from 'eslint-plugin-playwright';

        export default [
        playwright.configs['flat/recommended'],
        ];"
      `);
    });

    it('should keep configs that are not in the list', () => {
      const content = stripIndents`
        import nx from "@nx/eslint-plugin";
        import playwright from 'eslint-plugin-playwright';

        export default [
          ...nx.config['flat/base'],
          ...nx.config['flat/typescript'],
          ...nx.config['flat/javascript'],
          ...nx.config['flat/react'],
          playwright.configs['flat/recommended'],
        ];
      `;

      const result = removePredefinedConfigs(
        content,
        '@nx/eslint-plugin',
        'nx',
        ['flat/base', 'flat/typescript', 'flat/javascript']
      );

      expect(result).toMatchInlineSnapshot(`
        "import nx from "@nx/eslint-plugin";
        import playwright from 'eslint-plugin-playwright';

        export default [
        ...nx.config['flat/react'],
        playwright.configs['flat/recommended'],
        ];"
      `);
    });
  });

  describe('generatePluginExtendsElementWithCompatFixup', () => {
    it('should return spread element with fixupConfigRules call wrapping the extended plugin', () => {
      const result = generatePluginExtendsElementWithCompatFixup('my-plugin');

      expect(printTsNode(result)).toMatchInlineSnapshot(
        `"...fixupConfigRules(compat.extends("my-plugin"))"`
      );
    });
  });
});
