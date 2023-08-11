import ts = require('typescript');
import {
  addBlockToFlatConfigExport,
  generateAst,
  addImportToFlatConfig,
  addCompatToFlatConfig,
  removeOverridesFromLintConfig,
} from './ast-utils';

describe('ast-utils', () => {
  it('should inject block to the end of the file', () => {
    const content = `const baseConfig = require("../../eslint.config.js");
    module.exports = [
        ...baseConfig,
        {
            files: [
                "mylib/**/*.ts",
                "mylib/**/*.tsx"
            ],
            rules: {}
        },
        { ignores: ["mylib/.cache/**/*"] },
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
                      "mylib/**/*.ts",
                      "mylib/**/*.tsx"
                  ],
                  rules: {}
              },
              { ignores: ["mylib/.cache/**/*"] },
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
                "mylib/**/*.ts",
                "mylib/**/*.tsx"
            ],
            rules: {}
        },
        { ignores: ["mylib/.cache/**/*"] },
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
                      "mylib/**/*.ts",
                      "mylib/**/*.tsx"
                  ],
                  rules: {}
              },
              { ignores: ["mylib/.cache/**/*"] },
          ];"
    `);
  });

  it('should inject import if not found', () => {
    const content = `const baseConfig = require("../../eslint.config.js");
    module.exports = [
        ...baseConfig,
        {
            files: [
                "mylib/**/*.ts",
                "mylib/**/*.tsx"
            ],
            rules: {}
        },
        { ignores: ["mylib/.cache/**/*"] },
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
                      "mylib/**/*.ts",
                      "mylib/**/*.tsx"
                  ],
                  rules: {}
              },
              { ignores: ["mylib/.cache/**/*"] },
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
                "mylib/**/*.ts",
                "mylib/**/*.tsx"
            ],
            rules: {}
        },
        { ignores: ["mylib/.cache/**/*"] },
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
                      "mylib/**/*.ts",
                      "mylib/**/*.tsx"
                  ],
                  rules: {}
              },
              { ignores: ["mylib/.cache/**/*"] },
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
                "mylib/**/*.ts",
                "mylib/**/*.tsx"
            ],
            rules: {}
        },
        { ignores: ["mylib/.cache/**/*"] },
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
                "mylib/**/*.ts",
                "mylib/**/*.tsx"
            ],
            rules: {}
        },
        { ignores: ["mylib/.cache/**/*"] },
    ];`;
    const result = addImportToFlatConfig(
      content,
      'varName',
      '@myorg/awesome-config'
    );
    expect(result).toEqual(content);
  });

  it('should add compat to config', () => {
    const content = `const baseConfig = require("../../eslint.config.js");
    module.exports = [
      ...baseConfig,
      {
        files: [
          "mylib/**/*.ts",
          "mylib/**/*.tsx"
        ],
        rules: {}
      },
      { ignores: ["mylib/.cache/**/*"] },
    ];`;
    const result = addCompatToFlatConfig(content);
    expect(result).toMatchInlineSnapshot(`
      "const FlatCompat = require("@eslint/eslintrc");
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
                "mylib/**/*.ts",
                "mylib/**/*.tsx"
              ],
              rules: {}
            },
            { ignores: ["mylib/.cache/**/*"] },
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
          "mylib/**/*.ts",
          "mylib/**/*.tsx"
        ],
        rules: {}
      },
      { ignores: ["mylib/.cache/**/*"] },
    ];`;
    const result = addCompatToFlatConfig(content);
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
            {
              files: [
                "mylib/**/*.ts",
                "mylib/**/*.tsx"
              ],
              rules: {}
            },
            { ignores: ["mylib/.cache/**/*"] },
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
          "mylib/**/*.ts",
          "mylib/**/*.tsx"
        ],
        rules: {}
      },
      { ignores: ["mylib/.cache/**/*"] },
    ];`;
    const result = addCompatToFlatConfig(content);
    expect(result).toEqual(content);
  });

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
          "mylib/**/*.ts",
          "mylib/**/*.tsx"
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
      { ignores: ["mylib/.cache/**/*"] },
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
            { ignores: ["mylib/.cache/**/*"] },
          ];"
    `);
  });

  it('should remove all rules from starting with first', () => {
    const content = `const baseConfig = require("../../eslint.config.js");

    module.exports = [
      {
        files: [
          "mylib/**/*.ts",
          "mylib/**/*.tsx"
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
