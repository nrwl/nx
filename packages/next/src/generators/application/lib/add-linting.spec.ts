import {
  ProjectConfiguration,
  Tree,
  addProjectConfiguration,
  readJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { addLinting } from './add-linting';
import { Linter } from '@nx/eslint';
import { NormalizedSchema } from './normalize-options';

describe('updateEslint', () => {
  let tree: Tree;
  let schema: NormalizedSchema;

  beforeEach(async () => {
    schema = {
      projectName: 'my-app',
      appProjectRoot: 'my-app',
      linter: Linter.EsLint,
      unitTestRunner: 'jest',
      e2eProjectName: 'my-app-e2e',
      e2eProjectRoot: 'my-app-e2e',
      e2ePort: 3000,
      e2eWebServerTarget: 'start',
      e2eWebServerAddress: 'http://localhost:4200',
      outputPath: 'dist/my-app',
      name: 'my-app',
      parsedTags: [],
      fileName: 'index',
      e2eTestRunner: 'cypress',
      styledModule: null,
      projectNameAndRootFormat: 'as-provided',
    };
    tree = createTreeWithEmptyWorkspace();
    const project: ProjectConfiguration = {
      root: schema.appProjectRoot,
      sourceRoot: schema.appProjectRoot,
      projectType: 'application',
      targets: {},
      tags: schema.parsedTags,
    };

    addProjectConfiguration(tree, schema.projectName, {
      ...project,
    });
  });

  it('should update the eslintrc config', async () => {
    tree.write('.eslintrc.json', JSON.stringify({ extends: ['some-config'] }));

    await addLinting(tree, schema);

    expect(readJson(tree, `${schema.appProjectRoot}/.eslintrc.json`))
      .toMatchInlineSnapshot(`
      {
        "extends": [
          "plugin:@nx/react-typescript",
          "next",
          "next/core-web-vitals",
          "../.eslintrc.json",
        ],
        "ignorePatterns": [
          "!**/*",
          ".next/**/*",
        ],
        "overrides": [
          {
            "files": [
              "*.ts",
              "*.tsx",
              "*.js",
              "*.jsx",
            ],
            "rules": {
              "@next/next/no-html-link-for-pages": [
                "error",
                "my-app/pages",
              ],
            },
          },
          {
            "files": [
              "*.ts",
              "*.tsx",
            ],
            "rules": {},
          },
          {
            "files": [
              "*.js",
              "*.jsx",
            ],
            "rules": {},
          },
          {
            "env": {
              "jest": true,
            },
            "files": [
              "*.spec.ts",
              "*.spec.tsx",
              "*.spec.js",
              "*.spec.jsx",
            ],
          },
        ],
      }
    `);
  });

  it('should update the flat config', async () => {
    tree.write('eslint.config.js', `module.exports = []`);

    await addLinting(tree, schema);

    expect(tree.read(`${schema.appProjectRoot}/eslint.config.js`, 'utf-8'))
      .toMatchInlineSnapshot(`
      "const { FlatCompat } = require("@eslint/eslintrc");
      const js = require("@eslint/js");
      const baseConfig = require("../eslint.config.js");

      const compat = new FlatCompat({
            baseDirectory: __dirname,
            recommendedConfig: js.configs.recommended,
          });
        

      module.exports = [
      ...compat.extends("plugin:@nx/react-typescript", "next", "next/core-web-vitals"),
          ...baseConfig,
          {
        "files": [
          "**/*.ts",
          "**/*.tsx",
          "**/*.js",
          "**/*.jsx"
        ],
        "rules": {
          "@next/next/no-html-link-for-pages": [
            "error",
            "my-app/pages"
          ]
        }
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
          },
      ...compat.config({ env: { jest: true } }).map(config => ({
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
      { ignores: [".next/**/*"] }
      ];
      "
    `);
  });
});
