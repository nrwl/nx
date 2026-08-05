import {
  ProjectConfiguration,
  ProjectGraph,
  Tree,
  addProjectConfiguration,
  readJson,
  updateJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { addLinting } from './add-linting';
import { NormalizedSchema } from './normalize-options';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(async () => projectGraph),
}));

describe('updateEslint', () => {
  let tree: Tree;
  let schema: NormalizedSchema;

  beforeEach(async () => {
    projectGraph = { nodes: {}, dependencies: {}, externalNodes: {} };
    schema = {
      projectName: 'my-app',
      projectSimpleName: 'my-app',
      appProjectRoot: 'my-app',
      directory: 'my-app',
      importPath: '@proj/my-app',
      linter: 'eslint',
      unitTestRunner: 'jest',
      e2eProjectName: 'my-app-e2e',
      e2eProjectRoot: 'my-app-e2e',
      outputPath: 'dist/my-app',
      parsedTags: [],
      fileName: 'index',
      e2eTestRunner: 'cypress',
      isTsSolutionSetup: false,
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
        ],
      }
    `);
  });

  it('should update the flat config', async () => {
    tree.write('eslint.config.cjs', `module.exports = []`);

    await addLinting(tree, schema);

    expect(tree.read(`${schema.appProjectRoot}/eslint.config.cjs`, 'utf-8'))
      .toMatchInlineSnapshot(`
      "const nextEslintPluginNext = require("@next/eslint-plugin-next");
      const nx = require("@nx/eslint-plugin");
      const baseConfig = require("../eslint.config.cjs");

      module.exports = [
          { plugins: { "@next/next": nextEslintPluginNext } },

          ...nx.configs["flat/react-typescript"],
          ...baseConfig,
          {
              ignores: [
                  ".next/**/*"
              ]
          }
      ];
      "
    `);
  });

  it('should pin ESLint v9 when the workspace uses Next.js 15', async () => {
    projectGraph.externalNodes = {
      'npm:next': {
        type: 'npm',
        name: 'npm:next',
        data: { packageName: 'next', version: '15.2.4' },
      },
    };
    tree.write('eslint.config.cjs', `module.exports = []`);

    await addLinting(tree, schema);

    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies['eslint']).toBe('^9.8.0');
    expect(devDependencies['eslint-config-next']).toBe('^15.5.18');
    expect(devDependencies['eslint-plugin-react']).toBeDefined();
    expect(devDependencies['eslint-plugin-import-x']).toBeUndefined();
  });

  it('should keep an existing ESLint version when the workspace uses Next.js 15', async () => {
    projectGraph.externalNodes = {
      'npm:next': {
        type: 'npm',
        name: 'npm:next',
        data: { packageName: 'next', version: '15.2.4' },
      },
    };
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      devDependencies: { ...json.devDependencies, eslint: '^9.0.0' },
    }));
    tree.write('eslint.config.cjs', `module.exports = []`);

    await addLinting(tree, schema);

    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies['eslint']).toBe('^9.0.0');
  });

  it('should not pin ESLint v9 when the workspace uses the latest Next.js version', async () => {
    tree.write('eslint.config.cjs', `module.exports = []`);

    await addLinting(tree, schema);

    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies['eslint']).toBeUndefined();
    expect(devDependencies['eslint-plugin-import-x']).toBeDefined();
    expect(devDependencies['eslint-plugin-react']).toBeUndefined();
  });
});
