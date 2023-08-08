import ts = require('typescript');
import { addConfigToFlatConfigExport, generateAst } from './ast-utils';

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
});
