import ts = require('typescript');
import {
  addConfigToFlatConfigExport,
  generateAst,
  addImportToFlatConfig,
  generateRequire,
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
    const result = addConfigToFlatConfigExport(
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
    const result = addConfigToFlatConfigExport(
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

  it('should not update import if already exists', () => {
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
});
