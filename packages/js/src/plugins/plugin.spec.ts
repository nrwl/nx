import type { CreateNodesContext, CreateNodesResult } from '@nx/devkit';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { createNodes } from './plugin';

describe('@nx/js/plugin', () => {
  let createNodesFunction = createNodes[1];
  let context: CreateNodesContext;
  let tempFs: TempFs;

  beforeEach(async () => {
    tempFs = new TempFs('js-plugin');

    context = {
      nxJsonConfiguration: {
        namedInputs: {
          default: ['{projectRoot}/**/*'],
          production: ['!{projectRoot}/**/*.spec.ts'],
        },
      },
      workspaceRoot: tempFs.tempDir,
    };
  });

  afterEach(() => {
    jest.resetModules();
    tempFs.cleanup();
  });

  describe('@nx/js:tsc target', () => {
    it('should add a build target', async () => {
      await tempFs.createFiles({
        'package.json': '{}',
        'tsconfig.json': '{}',
        'src/index.ts': '',
      });

      const nodes = createNodesFunction('tsconfig.json', {}, context);

      expect(nodes).toMatchInlineSnapshot(`
        {
          "projects": {
            ".": {
              "projectType": "library",
              "root": ".",
              "targets": {
                "build": {
                  "cache": true,
                  "executor": "@nx/js:tsc",
                  "inputs": [
                    "default",
                    "^production",
                  ],
                  "options": {
                    "assets": [
                      "*.md",
                    ],
                    "main": "src/index.ts",
                    "outputPath": ".",
                    "tsConfig": "tsconfig.json",
                  },
                  "outputs": [
                    "{options.outputPath}",
                  ],
                },
              },
            },
          },
        }
      `);
    });

    it('should use "tsconfig.lib.json" when present', async () => {
      await tempFs.createFiles({
        'package.json': '{}',
        'tsconfig.json': '{}',
        'tsconfig.lib.json': '{}',
        'src/index.ts': '',
      });

      const nodes = createNodesFunction('tsconfig.json', {}, context);

      expect(nodes).toMatchInlineSnapshot(`
        {
          "projects": {
            ".": {
              "projectType": "library",
              "root": ".",
              "targets": {
                "build": {
                  "cache": true,
                  "executor": "@nx/js:tsc",
                  "inputs": [
                    "default",
                    "^production",
                  ],
                  "options": {
                    "assets": [
                      "*.md",
                    ],
                    "main": "src/index.ts",
                    "outputPath": ".",
                    "tsConfig": "tsconfig.lib.json",
                  },
                  "outputs": [
                    "{options.outputPath}",
                  ],
                },
              },
            },
          },
        }
      `);
    });

    it('should set "outputPath" to the value in "outDir"', async () => {
      await tempFs.createFiles({
        'package.json': '{}',
        'tsconfig.json': '{}',
        'tsconfig.lib.json': JSON.stringify({
          compilerOptions: {
            outDir: 'dist/lib1',
          },
        }),
        'src/index.ts': '',
      });

      const nodes = createNodesFunction(
        'tsconfig.json',
        {},
        context
      ) as CreateNodesResult;

      expect(nodes.projects['.'].targets.build.options.outputPath).toBe(
        'dist/lib1'
      );
    });

    it('should identify entry point from tsconfig "files" option', async () => {
      await tempFs.createFiles({
        'package.json': '{}',
        'tsconfig.json': '{}',
        'tsconfig.lib.json': JSON.stringify({
          files: ['src/public-api.ts'],
        }),
        'src/index.ts': '',
      });

      const nodes = createNodesFunction(
        'tsconfig.json',
        {},
        context
      ) as CreateNodesResult;

      expect(nodes.projects['.'].targets.build.options.main).toBe(
        'src/public-api.ts'
      );
    });

    it('should handle projects not at the root', async () => {
      await tempFs.createFiles({
        'libs/lib1/package.json': '{}',
        'libs/lib1/tsconfig.json': '{}',
        'libs/lib1/tsconfig.lib.json': JSON.stringify({
          compilerOptions: {
            outDir: '../../dist/lib1',
          },
        }),
        'libs/lib1/src/index.ts': '',
      });

      const nodes = createNodesFunction(
        'libs/lib1/tsconfig.json',
        {},
        context
      ) as CreateNodesResult;

      expect(nodes).toMatchInlineSnapshot(`
        {
          "projects": {
            "libs/lib1": {
              "projectType": "library",
              "root": "libs/lib1",
              "targets": {
                "build": {
                  "cache": true,
                  "executor": "@nx/js:tsc",
                  "inputs": [
                    "default",
                    "^production",
                  ],
                  "options": {
                    "assets": [
                      "libs/lib1/*.md",
                    ],
                    "main": "libs/lib1/src/index.ts",
                    "outputPath": "dist/lib1",
                    "tsConfig": "libs/lib1/tsconfig.lib.json",
                  },
                  "outputs": [
                    "{options.outputPath}",
                  ],
                },
              },
            },
          },
        }
      `);
    });

    it('should add a build target with a custom name', async () => {
      await tempFs.createFiles({
        'package.json': '{}',
        'tsconfig.json': '{}',
        'src/index.ts': '',
      });

      const nodes = createNodesFunction(
        'tsconfig.json',
        { buildTargetName: 'my-build' },
        context
      ) as CreateNodesResult;

      expect(nodes.projects['.'].targets['my-build']).toBeDefined();
      expect(nodes.projects['.'].targets.build).toBeUndefined();
    });

    it('should add a build target with custom tsconfig files', async () => {
      await tempFs.createFiles({
        'package.json': '{}',
        'tsconfig.json': '{}',
        'tsconfig.custom.json': '{}',
        'src/index.ts': '',
      });

      const nodes = createNodesFunction(
        'tsconfig.json',
        { buildPossibleTsConfigFiles: ['tsconfig.custom.json'] },
        context
      ) as CreateNodesResult;

      expect(nodes.projects['.'].targets.build.options.tsConfig).toBe(
        'tsconfig.custom.json'
      );
    });

    it('should add a build target with custom entry point files', async () => {
      await tempFs.createFiles({
        'package.json': '{}',
        'tsconfig.json': '{}',
        'src/public-api.ts': '',
      });

      const nodes = createNodesFunction(
        'tsconfig.json',
        { buildPossibleEntryPointFiles: ['src/public-api.ts'] },
        context
      ) as CreateNodesResult;

      expect(nodes.projects['.'].targets.build.options.main).toBe(
        'src/public-api.ts'
      );
    });

    it('should not create target when there is no "package.json"', async () => {
      await tempFs.createFiles({
        'project.json': '{}',
        'tsconfig.json': '{}',
        'src/index.ts': '',
      });

      const nodes = createNodesFunction('tsconfig.json', {}, context);

      expect(nodes).toStrictEqual({});
    });

    it('should not create target when existing "package.json" has "private: true"', async () => {
      await tempFs.createFiles({
        'package.json': '{ "private": true }',
        'tsconfig.json': '{}',
        'src/index.ts': '',
      });

      const nodes = createNodesFunction('tsconfig.json', {}, context);

      expect(nodes).toStrictEqual({});
    });

    it('should not create target when there is a config file for another known build tool', async () => {
      await tempFs.createFiles({
        'package.json': '{}',
        'tsconfig.json': '{}',
        'webpack.config.ts': '{}',
        'src/index.ts': '',
      });

      const nodes = createNodesFunction('tsconfig.json', {}, context);

      expect(nodes).toStrictEqual({});
    });

    it('should not create target when entry point file cannot be found', async () => {
      await tempFs.createFiles({
        'package.json': '{}',
        'tsconfig.json': '{}',
        'webpack.config.ts': '{}',
      });

      const nodes = createNodesFunction('tsconfig.json', {}, context);

      expect(nodes).toStrictEqual({});
    });
  });
});
