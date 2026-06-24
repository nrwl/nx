import {
  getProjects,
  readJson,
  readProjectConfiguration,
  updateJson,
  writeJson,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { libraryGenerator } from './library';

describe('lib', () => {
  let tree: Tree;
  let envBackup: string | undefined;

  beforeEach(() => {
    envBackup = process.env.ESLINT_USE_FLAT_CONFIG;
    delete process.env.ESLINT_USE_FLAT_CONFIG;
    tree = createTreeWithEmptyWorkspace();
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (envBackup === undefined) {
      delete process.env.ESLINT_USE_FLAT_CONFIG;
    } else {
      process.env.ESLINT_USE_FLAT_CONFIG = envBackup;
    }
  });

  describe('not nested', () => {
    it('should update project configuration', async () => {
      await libraryGenerator(tree, {
        directory: 'my-lib',
        addPlugin: true,
      });

      const config = readProjectConfiguration(tree, 'my-lib');
      expect(config).toMatchInlineSnapshot(`
        {
          "$schema": "../node_modules/nx/schemas/project-schema.json",
          "name": "my-lib",
          "projectType": "library",
          "root": "my-lib",
          "sourceRoot": "my-lib/src",
          "tags": [],
          "targets": {},
        }
      `);
    });

    it('should include a controller', async () => {
      await libraryGenerator(tree, {
        directory: 'my-lib',
        controller: true,
      });

      expect(tree.exists(`my-lib/src/lib/my-lib.controller.ts`)).toBeTruthy();
    });

    it('should include a service', async () => {
      await libraryGenerator(tree, {
        directory: 'my-lib',
        service: true,
      });

      expect(tree.exists(`my-lib/src/lib/my-lib.service.ts`)).toBeTruthy();
    });

    it('should add the @Global decorator', async () => {
      await libraryGenerator(tree, {
        directory: 'my-lib',
        global: true,
      });

      expect(
        tree.read(`my-lib/src/lib/my-lib.module.ts`, 'utf-8')
      ).toMatchSnapshot();
    });

    it('should remove the default file from @nx/node:lib', async () => {
      await libraryGenerator(tree, {
        directory: 'my-lib',
        global: true,
      });

      expect(tree.exists(`my-lib/src/lib/my-lib.spec.ts`)).toBeFalsy();
      expect(tree.exists(`my-lib/src/lib/my-lib.ts`)).toBeFalsy();
    });

    it('should provide the controller and service', async () => {
      await libraryGenerator(tree, {
        directory: 'my-lib',
        controller: true,
        service: true,
      });

      expect(
        tree.read(`my-lib/src/lib/my-lib.module.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`my-lib/src/lib/my-lib.controller.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(tree.read(`my-lib/src/index.ts`, 'utf-8')).toMatchSnapshot();
    });

    it('should update tags', async () => {
      await libraryGenerator(tree, {
        directory: 'my-lib',
        tags: 'one,two',
      });

      const projects = Object.fromEntries(getProjects(tree));
      expect(projects).toEqual({
        ['my-lib']: expect.objectContaining({
          tags: ['one', 'two'],
        }),
      });
    });

    it('should update root tsconfig.json', async () => {
      await libraryGenerator(tree, {
        directory: 'my-lib',
      });

      const tsconfigJson = readJson(tree, '/tsconfig.base.json');
      expect(tsconfigJson.compilerOptions.paths[`@proj/my-lib`]).toEqual([
        `./my-lib/src/index.ts`,
      ]);
    });

    it('should create a local tsconfig.json', async () => {
      await libraryGenerator(tree, {
        directory: 'my-lib',
      });

      const tsconfigJson = readJson(tree, `my-lib/tsconfig.json`);
      expect(tsconfigJson).toMatchSnapshot();
    });

    it('should extend the local tsconfig.json with tsconfig.spec.json', async () => {
      await libraryGenerator(tree, {
        directory: 'my-lib',
      });

      const tsconfigJson = readJson(tree, `my-lib/tsconfig.spec.json`);
      expect(tsconfigJson.extends).toEqual('./tsconfig.json');
    });

    it('should extend the local tsconfig.json with tsconfig.lib.json', async () => {
      await libraryGenerator(tree, {
        directory: 'my-lib',
      });

      const tsconfigJson = readJson(tree, `my-lib/tsconfig.lib.json`);
      expect(tsconfigJson.extends).toEqual('./tsconfig.json');
      expect(tsconfigJson.exclude).toEqual([
        'jest.config.ts',
        'jest.config.cts',
        'src/**/*.spec.ts',
        'src/**/*.test.ts',
      ]);
    });

    it('should generate files', async () => {
      await libraryGenerator(tree, {
        directory: 'my-lib',
      });

      expect(tree.exists(`my-lib/jest.config.cts`)).toBeTruthy();
      expect(tree.exists(`my-lib/src/index.ts`)).toBeTruthy();
      expect(tree.exists(`my-lib/src/lib/my-lib.spec.ts`)).toBeFalsy();
      expect(tree.exists(`my-lib/eslint.config.mjs`)).toBeTruthy();
    });

    it('should generate the .eslintrc.json file (eslintrc)', async () => {
      process.env.ESLINT_USE_FLAT_CONFIG = 'false';
      await libraryGenerator(tree, {
        directory: 'my-lib',
      });

      expect(readJson(tree, `my-lib/.eslintrc.json`)).toMatchSnapshot();
    });
  });

  describe('nested', () => {
    it('should update tags', async () => {
      await libraryGenerator(tree, {
        directory: 'my-dir/my-lib',
        tags: 'one,two',
      });

      const projects = Object.fromEntries(getProjects(tree));
      expect(projects).toEqual({
        [`my-lib`]: expect.objectContaining({
          tags: ['one', 'two'],
        }),
      });
    });

    it('should generate files', async () => {
      await libraryGenerator(tree, {
        directory: 'my-dir/my-lib',
      });

      expect(tree.exists(`my-dir/my-lib/jest.config.cts`)).toBeTruthy();
      expect(tree.exists(`my-dir/my-lib/src/index.ts`)).toBeTruthy();
      expect(tree.exists(`my-dir/my-lib/src/lib/my-lib.spec.ts`)).toBeFalsy();
    });

    it('should update tsconfig.json', async () => {
      await libraryGenerator(tree, {
        directory: 'my-dir/my-lib',
      });

      const tsconfigJson = readJson(tree, '/tsconfig.base.json');
      expect(tsconfigJson.compilerOptions.paths[`@proj/my-lib`]).toEqual([
        `./my-dir/my-lib/src/index.ts`,
      ]);
      expect(tsconfigJson.compilerOptions.paths[`my-lib/*`]).toBeUndefined();
    });

    it('should create a local tsconfig.json', async () => {
      await libraryGenerator(tree, {
        directory: 'my-dir/my-lib',
      });

      expect(readJson(tree, `my-dir/my-lib/tsconfig.json`)).toMatchSnapshot();
    });
  });

  describe('--strict', () => {
    it('should update the projects tsconfig with strict true', async () => {
      await libraryGenerator(tree, {
        directory: 'my-lib',
        strict: true,
      });

      const tsConfig = readJson(tree, `/my-lib/tsconfig.lib.json`);
      expect(tsConfig.compilerOptions.strictNullChecks).toBeTruthy();
      expect(tsConfig.compilerOptions.noImplicitAny).toBeTruthy();
      expect(tsConfig.compilerOptions.strictBindCallApply).toBeTruthy();
      expect(
        tsConfig.compilerOptions.forceConsistentCasingInFileNames
      ).toBeTruthy();
      expect(tsConfig.compilerOptions.noFallthroughCasesInSwitch).toBeTruthy();
    });
  });

  describe('--unit-test-runner none', () => {
    it('should not generate test configuration', async () => {
      await libraryGenerator(tree, {
        directory: 'my-lib',
        unitTestRunner: 'none',
      });

      expect(tree.exists(`my-lib/tsconfig.spec.json`)).toBeFalsy();
      expect(tree.exists(`my-lib/jest.config.cts`)).toBeFalsy();
      expect(tree.exists(`my-lib/lib/my-lib.spec.ts`)).toBeFalsy();
      expect(readJson(tree, `my-lib/tsconfig.json`)).toMatchSnapshot();
    });
  });

  describe('publishable package', () => {
    it('should update package.json', async () => {
      const importPath = `@proj/myLib`;

      await libraryGenerator(tree, {
        directory: 'my-lib',
        publishable: true,
        importPath,
      });

      const packageJson = readJson(tree, `my-lib/package.json`);
      expect(packageJson.name).toEqual(importPath);
    });
  });

  describe('compiler options target', () => {
    it('should set target to es6 in tsconfig.lib.json by default', async () => {
      await libraryGenerator(tree, {
        directory: 'my-lib',
      });

      const tsconfigJson = readJson(tree, `my-lib/tsconfig.lib.json`);
      expect(tsconfigJson.compilerOptions.target).toEqual('es6');
    });

    it('should set target to es2021 in tsconfig.lib.json', async () => {
      await libraryGenerator(tree, {
        directory: 'my-lib',
        target: 'es2021',
      });

      const tsconfigJson = readJson(tree, `my-lib/tsconfig.lib.json`);
      expect(tsconfigJson.compilerOptions.target).toEqual('es2021');
    });

    it('should enable decorators in tsconfig.lib.json for NestJS support', async () => {
      await libraryGenerator(tree, {
        directory: 'my-lib',
      });

      const tsconfigJson = readJson(tree, `my-lib/tsconfig.lib.json`);
      expect(tsconfigJson.compilerOptions.experimentalDecorators).toBe(true);
      expect(tsconfigJson.compilerOptions.emitDecoratorMetadata).toBe(true);
    });
  });

  describe('--skipFormat', () => {
    let formatFilesSpy: jest.SpyInstance;

    beforeEach(() => {
      const devkitModule = require('@nx/devkit');
      formatFilesSpy = jest
        .spyOn(devkitModule, 'formatFiles')
        .mockImplementation(() => Promise.resolve());
    });

    afterAll(() => {
      jest.restoreAllMocks();
    });

    it('should format files by default', async () => {
      await libraryGenerator(tree, {
        directory: 'my-lib',
      });

      expect(formatFilesSpy).toHaveBeenCalled();
    });

    it('should not format files when --skipFormat=true', async () => {
      await libraryGenerator(tree, {
        directory: 'my-lib',
        skipFormat: true,
      });

      expect(formatFilesSpy).not.toHaveBeenCalled();
    });
  });

  describe('--testEnvironment', () => {
    it('should set target jest testEnvironment to node by default', async () => {
      await libraryGenerator(tree, {
        directory: 'my-lib',
      });

      expect(tree.read(`my-lib/jest.config.cts`, 'utf-8')).toMatchSnapshot();
    });

    it('should set target jest testEnvironment to jsdom', async () => {
      await libraryGenerator(tree, {
        directory: 'my-lib',
        testEnvironment: 'jsdom',
      });

      expect(tree.read(`my-lib/jest.config.cts`, 'utf-8')).toMatchSnapshot();
    });
  });

  describe('TS solution setup', () => {
    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace();
      updateJson(tree, 'package.json', (json) => {
        json.workspaces = ['packages/*', 'apps/*'];
        return json;
      });
      writeJson(tree, 'tsconfig.base.json', {
        compilerOptions: {
          composite: true,
          declaration: true,
          customConditions: ['@proj/source'],
        },
      });
      writeJson(tree, 'tsconfig.json', {
        extends: './tsconfig.base.json',
        files: [],
        references: [],
      });
    });

    it('should add project references when using TS solution', async () => {
      await libraryGenerator(tree, {
        directory: 'mylib',
        unitTestRunner: 'jest',
        useProjectJson: false,
      });

      expect(readJson(tree, 'tsconfig.json').references).toEqual([]);
      expect(tree.exists('mylib/package.json')).toBeFalsy();
      expect(tree.exists('mylib/project.json')).toBeFalsy();
      const tsConfig = readJson(tree, 'mylib/tsconfig.json');
      expect(tsConfig.extends).toBe('../tsconfig.base.json');
      expect(tsConfig.references).toEqual([
        { path: './tsconfig.lib.json' },
        { path: './tsconfig.spec.json' },
      ]);
      expect(tsConfig.compilerOptions.module).toBe('commonjs');
      expect(tsConfig.compilerOptions.strict).toBe(true);

      const tsConfigLib = readJson(tree, 'mylib/tsconfig.lib.json');
      expect(tsConfigLib.extends).toBe('./tsconfig.json');
      expect(tsConfigLib.compilerOptions.declaration).toBe(true);
      expect(tsConfigLib.compilerOptions.target).toBe('es6');
      expect(tsConfigLib.compilerOptions.experimentalDecorators).toBe(true);
      expect(tsConfigLib.compilerOptions.emitDecoratorMetadata).toBe(true);
      expect(tsConfigLib.compilerOptions.outDir).toBe('../dist/out-tsc');

      const tsConfigSpec = readJson(tree, 'mylib/tsconfig.spec.json');
      expect(tsConfigSpec.extends).toBe('./tsconfig.json');
      expect(tsConfigSpec.compilerOptions.module).toBe('commonjs');
      expect(tsConfigSpec.compilerOptions.outDir).toBe('../dist/out-tsc');
      expect(tsConfigSpec.compilerOptions.types).toEqual(['jest', 'node']);
    });

    it('should create a correct package.json for buildable libraries', async () => {
      await libraryGenerator(tree, {
        directory: 'mylib',
        unitTestRunner: 'jest',
        useProjectJson: false,
        buildable: true,
        skipFormat: true,
      });

      expect(tree.read('mylib/package.json', 'utf-8')).toMatchInlineSnapshot(`
        "{
          "name": "@proj/mylib",
          "version": "0.0.1",
          "private": true,
          "type": "commonjs",
          "main": "./src/index.js",
          "types": "./src/index.d.ts",
          "nx": {
            "name": "mylib",
            "sourceRoot": "mylib/src",
            "projectType": "library",
            "targets": {
              "build": {
                "executor": "@nx/js:tsc",
                "outputs": [
                  "{options.outputPath}"
                ],
                "options": {
                  "outputPath": "dist/mylib",
                  "tsConfig": "mylib/tsconfig.lib.json",
                  "packageJson": "mylib/package.json",
                  "main": "mylib/src/index.ts",
                  "assets": [
                    "mylib/*.md"
                  ]
                }
              },
              "lint": {
                "executor": "@nx/eslint:lint"
              },
              "test": {
                "executor": "@nx/jest:jest",
                "outputs": [
                  "{workspaceRoot}/coverage/{projectRoot}"
                ],
                "options": {
                  "jestConfig": "mylib/jest.config.cts"
                }
              }
            }
          },
          "dependencies": {
            "tslib": "^2.3.0"
          }
        }
        "
      `);
    });

    it('should not set the custom condition in exports when it does not exist in tsconfig.base.json', async () => {
      updateJson(tree, 'tsconfig.base.json', (json) => {
        delete json.compilerOptions.customConditions;
        return json;
      });

      await libraryGenerator(tree, {
        directory: 'mylib',
        unitTestRunner: 'jest',
        useProjectJson: false,
        buildable: true,
        skipFormat: true,
      });

      expect(
        readJson(tree, 'mylib/package.json').exports?.['.']?.development
      ).toBeUndefined();
    });

    it('should set "nx.name" in package.json when the user provides a name that is different than the package name', async () => {
      await libraryGenerator(tree, {
        directory: 'mylib',
        name: 'my-lib', // import path contains the npm scope, so it would be different
        linter: 'none',
        unitTestRunner: 'none',
        useProjectJson: false,
        skipFormat: true,
      });

      expect(tree.exists('mylib/package.json')).toBeFalsy();
    });

    it('should not set "nx.name" in package.json when the provided name matches the package name', async () => {
      await libraryGenerator(tree, {
        directory: 'mylib',
        name: '@proj/my-lib',
        linter: 'none',
        unitTestRunner: 'none',
        useProjectJson: false,
        skipFormat: true,
      });

      expect(tree.exists('mylib/package.json')).toBeFalsy();
    });

    it('should not set "nx.name" in package.json when the user does not provide a name', async () => {
      await libraryGenerator(tree, {
        directory: 'mylib',
        linter: 'none',
        unitTestRunner: 'none',
        useProjectJson: false,
        skipFormat: true,
      });

      expect(tree.exists('mylib/package.json')).toBeFalsy();
    });

    it('should generate project.json if useProjectJson is true', async () => {
      await libraryGenerator(tree, {
        directory: 'mylib',
        unitTestRunner: 'jest',
        useProjectJson: true,
        skipFormat: true,
      });

      expect(tree.exists('mylib/project.json')).toBeTruthy();
      expect(readProjectConfiguration(tree, 'mylib')).toMatchInlineSnapshot(`
        {
          "$schema": "../node_modules/nx/schemas/project-schema.json",
          "name": "mylib",
          "projectType": "library",
          "root": "mylib",
          "sourceRoot": "mylib/src",
          "tags": [],
          "targets": {
            "lint": {
              "executor": "@nx/eslint:lint",
            },
            "test": {
              "executor": "@nx/jest:jest",
              "options": {
                "jestConfig": "mylib/jest.config.cts",
              },
              "outputs": [
                "{workspaceRoot}/coverage/{projectRoot}",
              ],
            },
          },
        }
      `);
      expect(tree.exists('mylib/package.json')).toBeFalsy();
    });
  });

  describe('non-TS solution setup', () => {
    beforeEach(() => {
      // Create a workspace without TS solution setup
      tree = createTreeWithEmptyWorkspace();
      // Remove workspaces to disable package manager workspaces
      updateJson(tree, 'package.json', (json) => {
        delete json.workspaces;
        return json;
      });
      // Remove tsconfig.json to prevent TS solution detection
      tree.delete('tsconfig.json');
      // Create tsconfig.base.json without composite (non-TS solution)
      writeJson(tree, 'tsconfig.base.json', {
        compilerOptions: {
          target: 'es2015',
          module: 'commonjs',
        },
      });
    });

    it('should add build target with correct output path for buildable libraries', async () => {
      await libraryGenerator(tree, {
        directory: 'mylib',
        buildable: true,
        unitTestRunner: 'none',
        linter: 'none',
        skipFormat: true,
      });

      const project = readProjectConfiguration(tree, 'mylib');
      expect(project.targets?.build).toBeDefined();
      expect(project.targets?.build?.executor).toBe('@nx/js:tsc');
      expect(project.targets?.build?.options?.outputPath).toBe('dist/mylib');
    });

    it('should add build target with correct output path for publishable libraries', async () => {
      await libraryGenerator(tree, {
        directory: 'mylib',
        publishable: true,
        importPath: '@proj/mylib',
        unitTestRunner: 'none',
        linter: 'none',
        skipFormat: true,
      });

      const project = readProjectConfiguration(tree, 'mylib');
      expect(project.targets?.build).toBeDefined();
      expect(project.targets?.build?.executor).toBe('@nx/js:tsc');
      expect(project.targets?.build?.options?.outputPath).toBe('dist/mylib');
    });
  });
});
