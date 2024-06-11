import ts = require('typescript');
import {
  addBlockToFlatConfigExport,
  generateAst,
  addImportToFlatConfig,
  addCompatToFlatConfig,
  removeOverridesFromLintConfig,
  replaceOverride,
  removePlugin,
  removeCompatExtends,
} from './ast-utils';

describe('ast-utils', () => {
  describe('addBlockToFlatConfigExport', () => {
    it('should inject block to the end of the file', () => {
      const content = `const baseConfig = require("../../eslint.config.js");
    module.exports = [
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
              "const baseConfig = require("../../eslint.config.js");
                  module.exports = [
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
                  files: ["**/*.svg"],
                  rules: { "@nx/do-something-with-svg": "error" }
              },
                  ];"
          `);
    });

    it('should inject spread to the beginning of the file', () => {
      const content = `const baseConfig = require("../../eslint.config.js");
    module.exports = [
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
              "const baseConfig = require("../../eslint.config.js");
                  module.exports = [
              ...config,
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
  });

  describe('addImportToFlatConfig', () => {
    it('should inject import if not found', () => {
      const content = `const baseConfig = require("../../eslint.config.js");
    module.exports = [
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
        'varName',
        '@myorg/awesome-config'
      );
      expect(result).toMatchInlineSnapshot(`
              "const varName = require("@myorg/awesome-config");
              const baseConfig = require("../../eslint.config.js");
                  module.exports = [
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
      const content = `const { varName } = require("@myorg/awesome-config");
    const baseConfig = require("../../eslint.config.js");
    module.exports = [
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
              "const { varName, otherName, someName  } = require("@myorg/awesome-config");
                  const baseConfig = require("../../eslint.config.js");
                  module.exports = [
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
      const content = `const { varName, otherName } = require("@myorg/awesome-config");
    const baseConfig = require("../../eslint.config.js");
    module.exports = [
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
      const content = `const varName = require("@myorg/awesome-config");
    const baseConfig = require("../../eslint.config.js");
    module.exports = [
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
        'varName',
        '@myorg/awesome-config'
      );
      expect(result).toEqual(content);
    });
  });

  describe('addCompatToFlatConfig', () => {
    it('should add compat to config', () => {
      const content = `const baseConfig = require("../../eslint.config.js");
    module.exports = [
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
      const result = addCompatToFlatConfig(content);
      expect(result).toMatchInlineSnapshot(`
        "const { FlatCompat } = require("@eslint/eslintrc");
        const js = require("@eslint/js");
        const baseConfig = require("../../eslint.config.js");
           
        const compat = new FlatCompat({
              baseDirectory: __dirname,
              recommendedConfig: js.configs.recommended,
            });
          
         module.exports = [
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
      const content = `const baseConfig = require("../../eslint.config.js");
    const js = require("@eslint/js");
    module.exports = [
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
      const result = addCompatToFlatConfig(content);
      expect(result).toMatchInlineSnapshot(`
        "const { FlatCompat } = require("@eslint/eslintrc");
        const baseConfig = require("../../eslint.config.js");
            const js = require("@eslint/js");
           
        const compat = new FlatCompat({
              baseDirectory: __dirname,
              recommendedConfig: js.configs.recommended,
            });
          
         module.exports = [
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
      const content = `const FlatCompat = require("@eslint/eslintrc");
    const baseConfig = require("../../eslint.config.js");
    const js = require("@eslint/js");

    const compat = new FlatCompat({
      baseDirectory: __dirname,
      recommendedConfig: js.configs.recommended,
    });

    module.exports = [
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
      const result = addCompatToFlatConfig(content);
      expect(result).toEqual(content);
    });
  });

  describe('removeOverridesFromLintConfig', () => {
    it('should remove all rules from config', () => {
      const content = `const FlatCompat = require("@eslint/eslintrc");
    const baseConfig = require("../../eslint.config.js");
    const js = require("@eslint/js");

    const compat = new FlatCompat({
      baseDirectory: __dirname,
      recommendedConfig: js.configs.recommended,
    });

    module.exports = [
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
              "const FlatCompat = require("@eslint/eslintrc");
                  const baseConfig = require("../../eslint.config.js");
                  const js = require("@eslint/js");

                  const compat = new FlatCompat({
                    baseDirectory: __dirname,
                    recommendedConfig: js.configs.recommended,
                  });

                  module.exports = [
                    ...baseConfig,
                    { ignores: ["my-lib/.cache/**/*"] },
                  ];"
          `);
    });

    it('should remove all rules from starting with first', () => {
      const content = `const baseConfig = require("../../eslint.config.js");

    module.exports = [
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
              "const baseConfig = require("../../eslint.config.js");

                  module.exports = [
                  ];"
          `);
    });
  });

  describe('replaceOverride', () => {
    it('should find and replace rules in override', () => {
      const content = `const baseConfig = require("../../eslint.config.js");

    module.exports = [
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
        "const baseConfig = require("../../eslint.config.js");

            module.exports = [
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
      const content = `const baseConfig = require("../../eslint.config.js");

    module.exports = [
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
        "const baseConfig = require("../../eslint.config.js");

            module.exports = [
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
      const content = `const baseConfig = require("../../eslint.config.js");

    module.exports = [
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
        "const baseConfig = require("../../eslint.config.js");

            module.exports = [
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
      const content = `const { FlatCompat } = require("@eslint/eslintrc");
      const nxEslintPlugin = require("@nx/eslint-plugin");
      const js = require("@eslint/js");
      const compat = new FlatCompat({
        baseDirectory: __dirname,
        recommendedConfig: js.configs.recommended,
      });
      module.exports = [
        { plugins: { "@nx": nxEslintPlugin } },
        { ignores: ["src/ignore/to/keep.ts"] },
        { ignores: ["something/else"] }
      ];`;

      const result = removePlugin(content, '@nx', '@nx/eslint-plugin');
      expect(result).toMatchInlineSnapshot(`
        "const { FlatCompat } = require("@eslint/eslintrc");
              const js = require("@eslint/js");
              const compat = new FlatCompat({
                baseDirectory: __dirname,
                recommendedConfig: js.configs.recommended,
              });
              module.exports = [
                { ignores: ["src/ignore/to/keep.ts"] },
                { ignores: ["something/else"] }
              ];"
      `);
    });

    it('should remove single plugin from config', () => {
      const content = `const { FlatCompat } = require("@eslint/eslintrc");
      const nxEslintPlugin = require("@nx/eslint-plugin");
      const otherPlugin = require("other/eslint-plugin");
      const js = require("@eslint/js");
      const compat = new FlatCompat({
        baseDirectory: __dirname,
        recommendedConfig: js.configs.recommended,
      });
      module.exports = [
        { plugins: { "@nx": nxEslintPlugin, "@other": otherPlugin } },
        { ignores: ["src/ignore/to/keep.ts"] },
        { ignores: ["something/else"] }
      ];`;

      const result = removePlugin(content, '@nx', '@nx/eslint-plugin');
      expect(result).toMatchInlineSnapshot(`
        "const { FlatCompat } = require("@eslint/eslintrc");
              const otherPlugin = require("other/eslint-plugin");
              const js = require("@eslint/js");
              const compat = new FlatCompat({
                baseDirectory: __dirname,
                recommendedConfig: js.configs.recommended,
              });
              module.exports = [
                { plugins: { "@other": otherPlugin } },
                { ignores: ["src/ignore/to/keep.ts"] },
                { ignores: ["something/else"] }
              ];"
      `);
    });

    it('should leave other properties in config', () => {
      const content = `const { FlatCompat } = require("@eslint/eslintrc");
      const nxEslintPlugin = require("@nx/eslint-plugin");
      const js = require("@eslint/js");
      const compat = new FlatCompat({
        baseDirectory: __dirname,
        recommendedConfig: js.configs.recommended,
      });
      module.exports = [
        { plugins: { "@nx": nxEslintPlugin }, rules: {} },
        { ignores: ["src/ignore/to/keep.ts"] },
        { ignores: ["something/else"] }
      ];`;

      const result = removePlugin(content, '@nx', '@nx/eslint-plugin');
      expect(result).toMatchInlineSnapshot(`
        "const { FlatCompat } = require("@eslint/eslintrc");
              const js = require("@eslint/js");
              const compat = new FlatCompat({
                baseDirectory: __dirname,
                recommendedConfig: js.configs.recommended,
              });
              module.exports = [
                { rules: {} },
                { ignores: ["src/ignore/to/keep.ts"] },
                { ignores: ["something/else"] }
              ];"
      `);
    });

    it('should remove single plugin from config array', () => {
      const content = `const { FlatCompat } = require("@eslint/eslintrc");
      const nxEslintPlugin = require("@nx/eslint-plugin");
      const js = require("@eslint/js");
      const compat = new FlatCompat({
        baseDirectory: __dirname,
        recommendedConfig: js.configs.recommended,
      });
      module.exports = [
        { plugins: ["@nx", "something-else"] },
        { ignores: ["src/ignore/to/keep.ts"] },
        { ignores: ["something/else"] }
      ];`;

      const result = removePlugin(content, '@nx', '@nx/eslint-plugin');
      expect(result).toMatchInlineSnapshot(`
        "const { FlatCompat } = require("@eslint/eslintrc");
              const js = require("@eslint/js");
              const compat = new FlatCompat({
                baseDirectory: __dirname,
                recommendedConfig: js.configs.recommended,
              });
              module.exports = [
                { plugins:["something-else"] },
                { ignores: ["src/ignore/to/keep.ts"] },
                { ignores: ["something/else"] }
              ];"
      `);
    });

    it('should leave other fields in the object', () => {
      const content = `const { FlatCompat } = require("@eslint/eslintrc");
      const nxEslintPlugin = require("@nx/eslint-plugin");
      const js = require("@eslint/js");
      const compat = new FlatCompat({
        baseDirectory: __dirname,
        recommendedConfig: js.configs.recommended,
      });
      module.exports = [
        { plugins: ["@nx"], rules: { } },
        { ignores: ["src/ignore/to/keep.ts"] },
        { ignores: ["something/else"] }
      ];`;

      const result = removePlugin(content, '@nx', '@nx/eslint-plugin');
      expect(result).toMatchInlineSnapshot(`
        "const { FlatCompat } = require("@eslint/eslintrc");
              const js = require("@eslint/js");
              const compat = new FlatCompat({
                baseDirectory: __dirname,
                recommendedConfig: js.configs.recommended,
              });
              module.exports = [
                { rules: { } },
                { ignores: ["src/ignore/to/keep.ts"] },
                { ignores: ["something/else"] }
              ];"
      `);
    });

    it('should remove entire plugin when array with single element', () => {
      const content = `const { FlatCompat } = require("@eslint/eslintrc");
      const nxEslintPlugin = require("@nx/eslint-plugin");
      const js = require("@eslint/js");
      const compat = new FlatCompat({
        baseDirectory: __dirname,
        recommendedConfig: js.configs.recommended,
      });
      module.exports = [
        { plugins: ["@nx"] },
        { ignores: ["src/ignore/to/keep.ts"] },
        { ignores: ["something/else"] }
      ];`;

      const result = removePlugin(content, '@nx', '@nx/eslint-plugin');
      expect(result).toMatchInlineSnapshot(`
        "const { FlatCompat } = require("@eslint/eslintrc");
              const js = require("@eslint/js");
              const compat = new FlatCompat({
                baseDirectory: __dirname,
                recommendedConfig: js.configs.recommended,
              });
              module.exports = [
                { ignores: ["src/ignore/to/keep.ts"] },
                { ignores: ["something/else"] }
              ];"
      `);
    });
  });

  describe('removeCompatExtends', () => {
    it('should remove compat extends from config', () => {
      const content = `const { FlatCompat } = require("@eslint/eslintrc");
      const nxEslintPlugin = require("@nx/eslint-plugin");
      const js = require("@eslint/js");
      const compat = new FlatCompat({
        baseDirectory: __dirname,
        recommendedConfig: js.configs.recommended,
      });
      module.exports = [
        { plugins: { "@nx": nxEslintPlugin } },
        ...compat.config({ extends: ["plugin:@nx/typescript"] }).map(config => ({
          ...config,
          files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
          rules: {}
        })),
        { ignores: ["src/ignore/to/keep.ts"] },
        ...compat.config({ extends: ["plugin:@nrwl/javascript"] }).map(config => ({
          files: ['*.js', '*.jsx'],
          ...config,
          rules: {}
        }))
      ];`;

      const result = removeCompatExtends(content, [
        'plugin:@nx/typescript',
        'plugin:@nx/javascript',
        'plugin:@nrwl/typescript',
        'plugin:@nrwl/javascript',
      ]);
      expect(result).toMatchInlineSnapshot(`
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
});
