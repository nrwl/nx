import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  getProjects,
  joinPathFragments,
  readJson,
  readProjectConfiguration,
  Tree,
  updateJson,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/eslint';
import { PackageJson } from 'nx/src/utils/package-json';
import { pluginGenerator } from './plugin';
import { Schema } from './schema';

const getSchema: (overrides?: Partial<Schema>) => Schema = (
  overrides = {}
) => ({
  directory: 'my-plugin',
  compiler: 'tsc',
  skipTsConfig: false,
  skipFormat: false,
  skipLintChecks: false,
  linter: Linter.EsLint,
  unitTestRunner: 'jest',
  ...overrides,
});

describe('NxPlugin Plugin Generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should update the project configuration', async () => {
    await pluginGenerator(tree, getSchema());
    const project = readProjectConfiguration(tree, 'my-plugin');
    expect(project.root).toEqual('my-plugin');
    expect(project.targets.build).toEqual({
      executor: '@nx/js:tsc',
      outputs: ['{options.outputPath}'],
      options: {
        outputPath: 'dist/my-plugin',
        tsConfig: 'my-plugin/tsconfig.lib.json',
        main: 'my-plugin/src/index.ts',
        assets: [
          'my-plugin/*.md',
          {
            input: './my-plugin/src',
            glob: '**/!(*.ts)',
            output: './src',
          },
          {
            input: './my-plugin/src',
            glob: '**/*.d.ts',
            output: './src',
          },
          {
            input: './my-plugin',
            glob: 'generators.json',
            output: '.',
          },
          {
            input: './my-plugin',
            glob: 'executors.json',
            output: '.',
          },
        ],
      },
    });
  });

  it('should place the plugin in a directory', async () => {
    await pluginGenerator(
      tree,
      getSchema({
        name: 'my-plugin',
        directory: 'plugins/my-plugin',
      })
    );
    const project = readProjectConfiguration(tree, 'my-plugin');
    const projectE2e = readProjectConfiguration(tree, 'my-plugin-e2e');
    expect(project.root).toEqual('plugins/my-plugin');
    expect(projectE2e.root).toEqual('plugins/my-plugin-e2e');
  });

  describe('asset paths', () => {
    it('should generate normalized asset paths for plugin in monorepo', async () => {
      await pluginGenerator(
        tree,
        getSchema({
          directory: 'my-plugin',
        })
      );
      const project = readProjectConfiguration(tree, 'my-plugin');
      const assets = project.targets.build.options.assets;
      expect(assets).toEqual([
        'my-plugin/*.md',
        {
          input: './my-plugin/src',
          glob: '**/!(*.ts)',
          output: './src',
        },
        {
          input: './my-plugin/src',
          glob: '**/*.d.ts',
          output: './src',
        },
        {
          input: './my-plugin',
          glob: 'generators.json',
          output: '.',
        },
        {
          input: './my-plugin',
          glob: 'executors.json',
          output: '.',
        },
      ]);
    });

    it('should generate normalized asset paths for plugin in standalone workspace', async () => {
      await pluginGenerator(
        tree,
        getSchema({
          name: 'my-plugin',
          directory: '.',
        })
      );
      const project = readProjectConfiguration(tree, 'my-plugin');
      const assets = project.targets.build.options.assets;
      expect(assets).toEqual([
        '*.md',
        {
          input: './src',
          glob: '**/!(*.ts)',
          output: './src',
        },
        {
          input: './src',
          glob: '**/*.d.ts',
          output: './src',
        },
        {
          input: '.',
          glob: 'generators.json',
          output: '.',
        },
        {
          input: '.',
          glob: 'executors.json',
          output: '.',
        },
      ]);
    });
  });

  describe('--unitTestRunner', () => {
    describe('none', () => {
      it('should not generate test files', async () => {
        await pluginGenerator(
          tree,
          getSchema({
            directory: 'my-plugin',
            unitTestRunner: 'none',
          })
        );

        ['my-plugin/jest.config.ts'].forEach((path) =>
          expect(tree.exists(path)).toBeFalsy()
        );

        ['my-plugin/vite.config.ts'].forEach((path) =>
          expect(tree.exists(path)).toBeFalsy()
        );

        expect(
          readProjectConfiguration(tree, 'my-plugin').targets.test
        ).not.toBeDefined();
      });
    });

    describe('jest', () => {
      it('should generate test files with jest.config.ts', async () => {
        await pluginGenerator(
          tree,
          getSchema({
            directory: 'my-plugin',
            unitTestRunner: 'jest',
          })
        );

        expect(tree.exists('my-plugin/jest.config.ts')).toBeTruthy();
        expect(tree.read('my-plugin/jest.config.ts', 'utf-8'))
          .toMatchInlineSnapshot(`
          "export default {
            displayName: 'my-plugin',
            preset: '../jest.preset.js',
            testEnvironment: 'node',
            transform: {
              '^.+\\\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
            },
            moduleFileExtensions: ['ts', 'js', 'html'],
            coverageDirectory: '../coverage/my-plugin',
          };
          "
        `);
        expect(tree.exists('my-plugin/.spec.swcrc')).toBeFalsy();

        const projectTargets = readProjectConfiguration(
          tree,
          'my-plugin'
        ).targets;

        expect(projectTargets.test).toBeDefined();
        expect(projectTargets.test?.executor).toEqual('@nx/jest:jest');
      });
    });

    describe('vitest', () => {
      it('should generate test files with vite.config.ts', async () => {
        await pluginGenerator(
          tree,
          getSchema({
            directory: 'my-plugin',
            unitTestRunner: 'vitest',
          })
        );

        ['my-plugin/vite.config.ts'].forEach((path) =>
          expect(tree.exists(path)).toBeTruthy()
        );

        const projectTargets = readProjectConfiguration(
          tree,
          'my-plugin'
        ).targets;

        expect(projectTargets.test).toBeDefined();
        expect(projectTargets.test?.executor).toEqual('@nx/vite:test');
      });
    });
  });

  describe('--compiler', () => {
    it('should specify tsc as compiler', async () => {
      await pluginGenerator(
        tree,
        getSchema({
          compiler: 'tsc',
        })
      );

      const { build } = readProjectConfiguration(tree, 'my-plugin').targets;

      expect(build.executor).toEqual('@nx/js:tsc');
    });

    it('should specify swc as compiler', async () => {
      await pluginGenerator(
        tree,
        getSchema({
          compiler: 'swc',
        })
      );

      const { build } = readProjectConfiguration(tree, 'my-plugin').targets;

      expect(build.executor).toEqual('@nx/js:swc');
    });
  });

  describe('--importPath', () => {
    it('should use the workspace npmScope by default for the package.json', async () => {
      await pluginGenerator(tree, getSchema());

      const { root } = readProjectConfiguration(tree, 'my-plugin');
      const { name } = readJson<PackageJson>(
        tree,
        joinPathFragments(root, 'package.json')
      );

      expect(name).toEqual('@proj/my-plugin');
    });

    it('should correctly setup npmScope less workspaces', async () => {
      updateJson(tree, 'package.json', (j) => {
        j.name = 'source';
        return j;
      });

      await pluginGenerator(tree, getSchema());

      const { root } = readProjectConfiguration(tree, 'my-plugin');
      const { name } = readJson<PackageJson>(
        tree,
        joinPathFragments(root, 'package.json')
      );

      expect(name).toEqual('my-plugin');
    });

    it('should use importPath as the package.json name', async () => {
      await pluginGenerator(
        tree,
        getSchema({ importPath: '@my-company/my-plugin' })
      );

      const { root } = readProjectConfiguration(tree, 'my-plugin');
      const { name } = readJson<PackageJson>(
        tree,
        joinPathFragments(root, 'package.json')
      );

      expect(name).toEqual('@my-company/my-plugin');
    });
  });

  describe('--e2eTestRunner', () => {
    it('should allow the e2e project to be skipped', async () => {
      await pluginGenerator(tree, getSchema({ e2eTestRunner: 'none' }));
      const projects = getProjects(tree);
      expect(projects.has('my-plugin-e2e')).toBe(false);
    });
  });

  describe('TS solution setup', () => {
    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace();
      tree.write('.gitignore', '');
      updateJson(tree, 'package.json', (json) => {
        json.workspaces = ['packages/*'];
        return json;
      });
      writeJson(tree, 'tsconfig.base.json', {
        compilerOptions: {
          composite: true,
          declaration: true,
        },
      });
      writeJson(tree, 'tsconfig.json', {
        extends: './tsconfig.base.json',
        files: [],
        references: [],
      });
    });

    it('should generate test files with jest.config.ts', async () => {
      await pluginGenerator(
        tree,
        getSchema({
          directory: 'my-plugin',
          unitTestRunner: 'jest',
          useProjectJson: false,
        })
      );

      expect(tree.exists('my-plugin/jest.config.ts')).toBeTruthy();
      expect(tree.read('my-plugin/jest.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "/* eslint-disable */
        import { readFileSync } from 'fs';

        // Reading the SWC compilation config for the spec files
        const swcJestConfig = JSON.parse(
          readFileSync(\`\${__dirname}/.spec.swcrc\`, 'utf-8')
        );

        // Disable .swcrc look-up by SWC core because we're passing in swcJestConfig ourselves
        swcJestConfig.swcrc = false;

        export default {
          displayName: '@proj/my-plugin',
          preset: '../jest.preset.js',
          testEnvironment: 'node',
          transform: {
            '^.+\\\\.[tj]s$': ['@swc/jest', swcJestConfig],
          },
          moduleFileExtensions: ['ts', 'js', 'html'],
          coverageDirectory: 'test-output/jest/coverage',
        };
        "
      `);
      expect(tree.exists('my-plugin/.spec.swcrc')).toBeTruthy();
      expect(tree.read('my-plugin/.spec.swcrc', 'utf-8'))
        .toMatchInlineSnapshot(`
        "{
          "jsc": {
            "target": "es2017",
            "parser": {
              "syntax": "typescript",
              "decorators": true,
              "dynamicImport": true
            },
            "transform": {
              "decoratorMetadata": true,
              "legacyDecorator": true
            },
            "keepClassNames": true,
            "externalHelpers": true,
            "loose": true
          },
          "module": {
            "type": "es6"
          },
          "sourceMaps": true,
          "exclude": []
        }
        "
      `);

      const projectTargets = readProjectConfiguration(
        tree,
        '@proj/my-plugin'
      ).targets;

      expect(projectTargets.test).toBeDefined();
      expect(projectTargets.test?.executor).toEqual('@nx/jest:jest');
    });

    it('should add project references when using TS solution', async () => {
      await pluginGenerator(
        tree,
        getSchema({
          e2eTestRunner: 'jest',
        })
      );

      expect(readJson(tree, 'tsconfig.json').references).toMatchInlineSnapshot(`
        [
          {
            "path": "./my-plugin",
          },
          {
            "path": "./my-plugin-e2e",
          },
        ]
      `);
      expect(readJson(tree, 'my-plugin/package.json')).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "tslib": "^2.3.0",
          },
          "exports": {
            ".": {
              "default": "./dist/index.js",
              "import": "./dist/index.js",
              "types": "./dist/index.d.ts",
            },
            "./package.json": "./package.json",
          },
          "main": "./dist/index.js",
          "module": "./dist/index.js",
          "name": "@proj/my-plugin",
          "types": "./dist/index.d.ts",
          "version": "0.0.1",
        }
      `);
      expect(readJson(tree, 'my-plugin/tsconfig.json')).toMatchInlineSnapshot(`
        {
          "extends": "../tsconfig.base.json",
          "files": [],
          "include": [],
          "references": [
            {
              "path": "./tsconfig.lib.json",
            },
            {
              "path": "./tsconfig.spec.json",
            },
          ],
        }
      `);
      expect(readJson(tree, 'my-plugin/tsconfig.lib.json'))
        .toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "baseUrl": ".",
            "emitDeclarationOnly": false,
            "module": "nodenext",
            "moduleResolution": "nodenext",
            "outDir": "dist",
            "rootDir": "src",
            "tsBuildInfoFile": "dist/tsconfig.lib.tsbuildinfo",
            "types": [
              "node",
            ],
          },
          "exclude": [
            "jest.config.ts",
            "src/**/*.spec.ts",
            "src/**/*.test.ts",
          ],
          "extends": "../tsconfig.base.json",
          "include": [
            "src/**/*.ts",
          ],
          "references": [],
        }
      `);
      expect(readJson(tree, 'my-plugin/tsconfig.spec.json'))
        .toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "module": "nodenext",
            "moduleResolution": "nodenext",
            "outDir": "./out-tsc/jest",
            "types": [
              "jest",
              "node",
            ],
          },
          "extends": "../tsconfig.base.json",
          "include": [
            "jest.config.ts",
            "src/**/*.test.ts",
            "src/**/*.spec.ts",
            "src/**/*.d.ts",
          ],
          "references": [
            {
              "path": "./tsconfig.lib.json",
            },
          ],
        }
      `);
    });

    it('should set "nx.name" in package.json when the user provides a name that is different than the package name and "useProjectJson" is "false"', async () => {
      await pluginGenerator(tree, {
        directory: 'my-plugin',
        name: 'my-plugin', // import path contains the npm scope, so it would be different
        useProjectJson: false,
        skipFormat: true,
      });

      expect(readJson(tree, 'my-plugin/package.json').nx.name).toBe(
        'my-plugin'
      );
    });

    it('should not set "nx.name" in package.json when the provided name matches the package name', async () => {
      await pluginGenerator(tree, {
        directory: 'my-plugin',
        name: '@proj/my-plugin',
        useProjectJson: false,
        skipFormat: true,
      });

      expect(readJson(tree, 'my-plugin/package.json').nx.name).toBeUndefined();
    });

    it('should not set "nx" in package.json when "useProjectJson" is "true"', async () => {
      await pluginGenerator(tree, {
        directory: 'my-plugin',
        name: '@proj/my-plugin',
        useProjectJson: true,
        skipFormat: true,
      });

      expect(readJson(tree, 'my-plugin/package.json').nx).toBeUndefined();
    });

    it('should not set "nx.name" in package.json when the user does not provide a name', async () => {
      await pluginGenerator(tree, {
        directory: 'my-plugin',
        useProjectJson: false,
        skipFormat: true,
      });

      expect(readJson(tree, 'my-plugin/package.json').nx.name).toBeUndefined();
    });
  });
});
