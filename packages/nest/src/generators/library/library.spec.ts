import type { Tree } from '@nx/devkit';
import * as devkit from '@nx/devkit';
import { readJson, readProjectConfiguration, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { libraryGenerator } from './library';

describe('lib', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    jest.clearAllMocks();
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

      const projects = Object.fromEntries(devkit.getProjects(tree));
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
        `my-lib/src/index.ts`,
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
        'src/**/*.spec.ts',
        'src/**/*.test.ts',
      ]);
    });

    it('should generate files', async () => {
      await libraryGenerator(tree, {
        directory: 'my-lib',
      });

      expect(tree.exists(`my-lib/jest.config.ts`)).toBeTruthy();
      expect(tree.exists(`my-lib/src/index.ts`)).toBeTruthy();
      expect(tree.exists(`my-lib/src/lib/my-lib.spec.ts`)).toBeFalsy();
      expect(readJson(tree, `my-lib/.eslintrc.json`)).toMatchSnapshot();
    });
  });

  describe('nested', () => {
    it('should update tags', async () => {
      await libraryGenerator(tree, {
        directory: 'my-dir/my-lib',
        tags: 'one,two',
      });

      const projects = Object.fromEntries(devkit.getProjects(tree));
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

      expect(tree.exists(`my-dir/my-lib/jest.config.ts`)).toBeTruthy();
      expect(tree.exists(`my-dir/my-lib/src/index.ts`)).toBeTruthy();
      expect(tree.exists(`my-dir/my-lib/src/lib/my-lib.spec.ts`)).toBeFalsy();
    });

    it('should update tsconfig.json', async () => {
      await libraryGenerator(tree, {
        directory: 'my-dir/my-lib',
      });

      const tsconfigJson = readJson(tree, '/tsconfig.base.json');
      expect(tsconfigJson.compilerOptions.paths[`@proj/my-lib`]).toEqual([
        `my-dir/my-lib/src/index.ts`,
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
      expect(tree.exists(`my-lib/jest.config.ts`)).toBeFalsy();
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
  });

  describe('--skipFormat', () => {
    it('should format files by default', async () => {
      jest.spyOn(devkit, 'formatFiles');

      await libraryGenerator(tree, {
        directory: 'my-lib',
      });

      expect(devkit.formatFiles).toHaveBeenCalled();
    });

    it('should not format files when --skipFormat=true', async () => {
      jest.spyOn(devkit, 'formatFiles');

      await libraryGenerator(tree, {
        directory: 'my-lib',
        skipFormat: true,
      });

      expect(devkit.formatFiles).not.toHaveBeenCalled();
    });
  });

  describe('--testEnvironment', () => {
    it('should set target jest testEnvironment to node by default', async () => {
      await libraryGenerator(tree, {
        directory: 'my-lib',
      });

      expect(tree.read(`my-lib/jest.config.ts`, 'utf-8')).toMatchSnapshot();
    });

    it('should set target jest testEnvironment to jsdom', async () => {
      await libraryGenerator(tree, {
        directory: 'my-lib',
        testEnvironment: 'jsdom',
      });

      expect(tree.read(`my-lib/jest.config.ts`, 'utf-8')).toMatchSnapshot();
    });
  });

  describe('--simpleName', () => {
    it('should generate a library with a simple name', async () => {
      await libraryGenerator(tree, {
        simpleName: true,
        directory: 'api/my-lib',
        service: true,
        controller: true,
      });

      const indexFile = tree.read('api/my-lib/src/index.ts', 'utf-8');

      expect(indexFile).toContain(`export * from './lib/my-lib.module';`);
      expect(indexFile).toContain(`export * from './lib/my-lib.service';`);
      expect(indexFile).toContain(`export * from './lib/my-lib.controller';`);

      expect(tree.exists('api/my-lib/src/lib/my-lib.module.ts')).toBeTruthy();

      expect(tree.exists('api/my-lib/src/lib/my-lib.service.ts')).toBeTruthy();

      expect(
        tree.exists('api/my-lib/src/lib/my-lib.service.spec.ts')
      ).toBeTruthy();

      expect(
        tree.exists('api/my-lib/src/lib/my-lib.controller.ts')
      ).toBeTruthy();

      expect(
        tree.exists('api/my-lib/src/lib/my-lib.controller.spec.ts')
      ).toBeTruthy();
    });
  });

  describe('TS solution setup', () => {
    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace();
      devkit.updateJson(tree, 'package.json', (json) => {
        json.workspaces = ['packages/*', 'apps/*'];
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

    it('should add project references when using TS solution', async () => {
      await libraryGenerator(tree, {
        directory: 'mylib',
        unitTestRunner: 'jest',
      });

      expect(readJson(tree, 'tsconfig.json').references).toMatchInlineSnapshot(`
        [
          {
            "path": "./mylib",
          },
        ]
      `);
      expect(readJson(tree, 'mylib/package.json')).toMatchInlineSnapshot(`
        {
          "dependencies": {},
          "exports": {
            ".": {
              "default": "./src/index.ts",
              "import": "./src/index.ts",
              "types": "./src/index.ts",
            },
            "./package.json": "./package.json",
          },
          "main": "./src/index.ts",
          "name": "@proj/mylib",
          "nx": {
            "targets": {
              "lint": {
                "executor": "@nx/eslint:lint",
              },
              "test": {
                "executor": "@nx/jest:jest",
                "options": {
                  "jestConfig": "mylib/jest.config.ts",
                },
                "outputs": [
                  "{projectRoot}/test-output/jest/coverage",
                ],
              },
            },
          },
          "private": true,
          "types": "./src/index.ts",
          "version": "0.0.1",
        }
      `);
      expect(readJson(tree, 'mylib/tsconfig.json')).toMatchInlineSnapshot(`
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
      expect(readJson(tree, 'mylib/tsconfig.lib.json')).toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "baseUrl": ".",
            "emitDeclarationOnly": true,
            "forceConsistentCasingInFileNames": true,
            "importHelpers": true,
            "module": "nodenext",
            "moduleResolution": "nodenext",
            "noFallthroughCasesInSwitch": true,
            "noImplicitAny": true,
            "noImplicitOverride": true,
            "noImplicitReturns": true,
            "outDir": "dist",
            "rootDir": "src",
            "strict": true,
            "strictBindCallApply": true,
            "strictNullChecks": true,
            "target": "es6",
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
      expect(readJson(tree, 'mylib/tsconfig.spec.json')).toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "forceConsistentCasingInFileNames": true,
            "importHelpers": true,
            "module": "nodenext",
            "moduleResolution": "nodenext",
            "noFallthroughCasesInSwitch": true,
            "noImplicitOverride": true,
            "noImplicitReturns": true,
            "outDir": "./out-tsc/jest",
            "strict": true,
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

    it('should set "nx.name" in package.json when the user provides a name that is different than the package name', async () => {
      await libraryGenerator(tree, {
        directory: 'mylib',
        name: 'my-lib', // import path contains the npm scope, so it would be different
        linter: 'none',
        unitTestRunner: 'none',
        skipFormat: true,
      });

      expect(readJson(tree, 'mylib/package.json').nx).toStrictEqual({
        name: 'my-lib',
      });
    });

    it('should not set "nx.name" in package.json when the provided name matches the package name', async () => {
      await libraryGenerator(tree, {
        directory: 'mylib',
        name: '@proj/my-lib',
        linter: 'none',
        unitTestRunner: 'none',
        skipFormat: true,
      });

      expect(readJson(tree, 'mylib/package.json').nx).toBeUndefined();
    });

    it('should not set "nx.name" in package.json when the user does not provide a name', async () => {
      await libraryGenerator(tree, {
        directory: 'mylib',
        linter: 'none',
        unitTestRunner: 'none',
        skipFormat: true,
      });

      expect(readJson(tree, 'mylib/package.json').nx).toBeUndefined();
    });
  });
});
