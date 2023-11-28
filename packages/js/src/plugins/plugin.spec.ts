import type {
  CreateNodesContext,
  CreateNodesFunction,
  CreateNodesResult,
} from '@nx/devkit';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import type { JsPluginOptions } from './plugin';

describe('@nx/js/plugin', () => {
  let createNodesFunction: CreateNodesFunction<JsPluginOptions>;
  let context: CreateNodesContext;
  let tempFs: TempFs;

  beforeEach(async () => {
    jest.resetModules();
    createNodesFunction = (await import('./plugin')).createNodes[1];

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

    it('should identify entry point from "package.json" "main" field', async () => {
      await tempFs.createFiles({
        'package.json': '{ "main": "src/public-api.ts" }',
        'tsconfig.json': '{}',
        'src/public-api.ts': '',
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

    it('should identify entry point from "package.json" "module" field when "type: module"', async () => {
      await tempFs.createFiles({
        'package.json': '{ "type": "module", "module": "src/public-api.ts" }',
        'tsconfig.json': '{}',
        'src/public-api.ts': '',
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

    it('should identify entry point from "package.json" "exports" field when no "main" or "module"', async () => {
      await tempFs.createFiles({
        'package.json': '{ "exports": { ".": "src/public-api.ts" } }',
        'tsconfig.json': '{}',
        'src/public-api.ts': '',
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

    it('should identify entry point from tsconfig "files" option when there is only one and could not be found in "package.json"', async () => {
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
        { tsConfigFiles: ['tsconfig.custom.json'] },
        context
      ) as CreateNodesResult;

      expect(nodes.projects['.'].targets.build.options.tsConfig).toBe(
        'tsconfig.custom.json'
      );
    });

    it('should add a build target with custom main files', async () => {
      await tempFs.createFiles({
        'package.json': '{}',
        'tsconfig.json': '{}',
        'src/public-api.ts': '',
      });

      const nodes = createNodesFunction(
        'tsconfig.json',
        { packageMainFiles: ['src/public-api.ts'] },
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
