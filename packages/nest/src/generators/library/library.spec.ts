import type { Tree } from '@nx/devkit';
import * as devkit from '@nx/devkit';
import { readJson, readProjectConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { libraryGenerator } from './library';

describe('lib', () => {
  let tree: Tree;
  const libFileName = 'my-lib';
  const libName = 'myLib';

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    jest.clearAllMocks();
  });

  describe('not nested', () => {
    it('should update project configuration', async () => {
      await libraryGenerator(tree, { name: libName });

      const config = readProjectConfiguration(tree, libFileName);
      expect(config.root).toEqual(`libs/${libFileName}`);
      expect(config.targets.build).toBeUndefined();
      expect(config.targets.lint).toEqual({
        executor: '@nx/linter:eslint',
        outputs: ['{options.outputFile}'],
        options: {
          lintFilePatterns: [`libs/${libFileName}/**/*.ts`],
        },
      });
      expect(config.targets.test).toEqual({
        executor: '@nx/jest:jest',
        outputs: [`{workspaceRoot}/coverage/{projectRoot}`],
        options: {
          jestConfig: `libs/${libFileName}/jest.config.ts`,
          passWithNoTests: true,
        },
        configurations: {
          ci: {
            ci: true,
            codeCoverage: true,
          },
        },
      });
    });

    it('should include a controller', async () => {
      await libraryGenerator(tree, { name: libName, controller: true });

      expect(
        tree.exists(`libs/${libFileName}/src/lib/${libFileName}.controller.ts`)
      ).toBeTruthy();
    });

    it('should include a service', async () => {
      await libraryGenerator(tree, { name: libName, service: true });

      expect(
        tree.exists(`libs/${libFileName}/src/lib/${libFileName}.service.ts`)
      ).toBeTruthy();
    });

    it('should add the @Global decorator', async () => {
      await libraryGenerator(tree, { name: libName, global: true });

      expect(
        tree.read(
          `libs/${libFileName}/src/lib/${libFileName}.module.ts`,
          'utf-8'
        )
      ).toMatchSnapshot();
    });

    it('should remove the default file from @nx/node:lib', async () => {
      await libraryGenerator(tree, { name: libName, global: true });

      expect(
        tree.exists(`libs/${libFileName}/src/lib/${libFileName}.spec.ts`)
      ).toBeFalsy();
      expect(
        tree.exists(`libs/${libFileName}/src/lib/${libFileName}.ts`)
      ).toBeFalsy();
    });

    it('should provide the controller and service', async () => {
      await libraryGenerator(tree, {
        name: libName,
        controller: true,
        service: true,
      });

      expect(
        tree.read(
          `libs/${libFileName}/src/lib/${libFileName}.module.ts`,
          'utf-8'
        )
      ).toMatchSnapshot();
      expect(
        tree.read(
          `libs/${libFileName}/src/lib/${libFileName}.controller.ts`,
          'utf-8'
        )
      ).toMatchSnapshot();
      expect(
        tree.read(`libs/${libFileName}/src/index.ts`, 'utf-8')
      ).toMatchSnapshot();
    });

    it('should update tags', async () => {
      await libraryGenerator(tree, { name: libName, tags: 'one,two' });

      const projects = Object.fromEntries(devkit.getProjects(tree));
      expect(projects).toEqual({
        [libFileName]: expect.objectContaining({
          tags: ['one', 'two'],
        }),
      });
    });

    it('should update root tsconfig.json', async () => {
      await libraryGenerator(tree, { name: libName });

      const tsconfigJson = readJson(tree, '/tsconfig.base.json');
      expect(
        tsconfigJson.compilerOptions.paths[`@proj/${libFileName}`]
      ).toEqual([`libs/${libFileName}/src/index.ts`]);
    });

    it('should create a local tsconfig.json', async () => {
      await libraryGenerator(tree, { name: libName });

      const tsconfigJson = readJson(tree, `libs/${libFileName}/tsconfig.json`);
      expect(tsconfigJson).toMatchSnapshot();
    });

    it('should extend the local tsconfig.json with tsconfig.spec.json', async () => {
      await libraryGenerator(tree, { name: libName });

      const tsconfigJson = readJson(
        tree,
        `libs/${libFileName}/tsconfig.spec.json`
      );
      expect(tsconfigJson.extends).toEqual('./tsconfig.json');
    });

    it('should extend the local tsconfig.json with tsconfig.lib.json', async () => {
      await libraryGenerator(tree, { name: libName });

      const tsconfigJson = readJson(
        tree,
        `libs/${libFileName}/tsconfig.lib.json`
      );
      expect(tsconfigJson.extends).toEqual('./tsconfig.json');
      expect(tsconfigJson.exclude).toEqual([
        'jest.config.ts',
        'src/**/*.spec.ts',
        'src/**/*.test.ts',
      ]);
    });

    it('should generate files', async () => {
      await libraryGenerator(tree, { name: libName });

      expect(tree.exists(`libs/${libFileName}/jest.config.ts`)).toBeTruthy();
      expect(tree.exists(`libs/${libFileName}/src/index.ts`)).toBeTruthy();
      expect(
        tree.exists(`libs/${libFileName}/src/lib/${libFileName}.spec.ts`)
      ).toBeFalsy();
      expect(
        readJson(tree, `libs/${libFileName}/.eslintrc.json`)
      ).toMatchSnapshot();
    });
  });

  describe('nested', () => {
    const dirName = 'myDir';
    const dirFileName = 'my-dir';
    const nestedLibFileName = `${dirFileName}-${libFileName}`;

    it('should update tags', async () => {
      await libraryGenerator(tree, {
        name: libName,
        directory: dirName,
        tags: 'one,two',
      });

      const projects = Object.fromEntries(devkit.getProjects(tree));
      expect(projects).toEqual({
        [nestedLibFileName]: expect.objectContaining({ tags: ['one', 'two'] }),
      });
    });

    it('should generate files', async () => {
      await libraryGenerator(tree, { name: libName, directory: dirName });

      expect(
        tree.exists(`libs/${dirFileName}/${libFileName}/jest.config.ts`)
      ).toBeTruthy();
      expect(
        tree.exists(`libs/${dirFileName}/${libFileName}/src/index.ts`)
      ).toBeTruthy();
      expect(
        tree.exists(
          `libs/${dirFileName}/${libFileName}/src/lib/${libFileName}.spec.ts`
        )
      ).toBeFalsy();
    });

    it('should update workspace.json', async () => {
      await libraryGenerator(tree, { name: libName, directory: dirName });

      const project = readProjectConfiguration(tree, nestedLibFileName);
      expect(project.root).toEqual(`libs/${dirFileName}/${libFileName}`);
      expect(project.targets.lint).toEqual({
        executor: '@nx/linter:eslint',
        outputs: ['{options.outputFile}'],
        options: {
          lintFilePatterns: [`libs/${dirFileName}/${libFileName}/**/*.ts`],
        },
      });
    });

    it('should update tsconfig.json', async () => {
      await libraryGenerator(tree, { name: libName, directory: dirName });

      const tsconfigJson = readJson(tree, '/tsconfig.base.json');
      expect(
        tsconfigJson.compilerOptions.paths[
          `@proj/${dirFileName}/${libFileName}`
        ]
      ).toEqual([`libs/${dirFileName}/${libFileName}/src/index.ts`]);
      expect(
        tsconfigJson.compilerOptions.paths[`${nestedLibFileName}/*`]
      ).toBeUndefined();
    });

    it('should create a local tsconfig.json', async () => {
      await libraryGenerator(tree, { name: libName, directory: dirName });

      expect(
        readJson(tree, `libs/${dirFileName}/${libFileName}/tsconfig.json`)
      ).toMatchSnapshot();
    });
  });

  describe('--strict', () => {
    it('should update the projects tsconfig with strict true', async () => {
      await libraryGenerator(tree, { name: libName, strict: true });

      const tsConfig = readJson(tree, `/libs/${libFileName}/tsconfig.lib.json`);
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
      await libraryGenerator(tree, { name: libName, unitTestRunner: 'none' });

      expect(tree.exists(`libs/${libFileName}/tsconfig.spec.json`)).toBeFalsy();
      expect(tree.exists(`libs/${libFileName}/jest.config.ts`)).toBeFalsy();
      expect(
        tree.exists(`libs/${libFileName}/lib/${libFileName}.spec.ts`)
      ).toBeFalsy();
      expect(
        readJson(tree, `libs/${libFileName}/tsconfig.json`)
      ).toMatchSnapshot();
      const project = readProjectConfiguration(tree, libFileName);
      expect(project.targets.test).toBeUndefined();
      expect(project.targets.lint).toMatchSnapshot();
    });
  });

  describe('publishable package', () => {
    it('should update package.json', async () => {
      const importPath = `@proj/${libName}`;

      await libraryGenerator(tree, {
        name: libName,
        publishable: true,
        importPath,
      });

      const packageJson = readJson(tree, `libs/${libFileName}/package.json`);
      expect(packageJson.name).toEqual(importPath);
    });
  });

  describe('compiler options target', () => {
    it('should set target to es6 in tsconfig.lib.json by default', async () => {
      await libraryGenerator(tree, { name: libName });

      const tsconfigJson = readJson(
        tree,
        `libs/${libFileName}/tsconfig.lib.json`
      );
      expect(tsconfigJson.compilerOptions.target).toEqual('es6');
    });

    it('should set target to es2021 in tsconfig.lib.json', async () => {
      await libraryGenerator(tree, { name: libName, target: 'es2021' });

      const tsconfigJson = readJson(
        tree,
        `libs/${libFileName}/tsconfig.lib.json`
      );
      expect(tsconfigJson.compilerOptions.target).toEqual('es2021');
    });
  });

  describe('--skipFormat', () => {
    it('should format files by default', async () => {
      jest.spyOn(devkit, 'formatFiles');

      await libraryGenerator(tree, { name: libName });

      expect(devkit.formatFiles).toHaveBeenCalled();
    });

    it('should not format files when --skipFormat=true', async () => {
      jest.spyOn(devkit, 'formatFiles');

      await libraryGenerator(tree, { name: libName, skipFormat: true });

      expect(devkit.formatFiles).not.toHaveBeenCalled();
    });
  });

  describe('--testEnvironment', () => {
    it('should set target jest testEnvironment to node by default', async () => {
      await libraryGenerator(tree, { name: libName });

      expect(
        tree.read(`libs/${libFileName}/jest.config.ts`, 'utf-8')
      ).toMatchSnapshot();
    });

    it('should set target jest testEnvironment to jsdom', async () => {
      await libraryGenerator(tree, { name: libName, testEnvironment: 'jsdom' });

      expect(
        tree.read(`libs/${libFileName}/jest.config.ts`, 'utf-8')
      ).toMatchSnapshot();
    });
  });

  describe('--simpleName', () => {
    it('should generate a library with a simple name', async () => {
      await libraryGenerator(tree, {
        name: libName,
        simpleName: true,
        directory: 'api',
        service: true,
        controller: true,
      });

      const indexFile = tree.read('libs/api/my-lib/src/index.ts', 'utf-8');

      expect(indexFile).toContain(`export * from './lib/my-lib.module';`);
      expect(indexFile).toContain(`export * from './lib/my-lib.service';`);
      expect(indexFile).toContain(`export * from './lib/my-lib.controller';`);

      expect(
        tree.exists('libs/api/my-lib/src/lib/my-lib.module.ts')
      ).toBeTruthy();

      expect(
        tree.exists('libs/api/my-lib/src/lib/my-lib.service.ts')
      ).toBeTruthy();

      expect(
        tree.exists('libs/api/my-lib/src/lib/my-lib.service.spec.ts')
      ).toBeTruthy();

      expect(
        tree.exists('libs/api/my-lib/src/lib/my-lib.controller.ts')
      ).toBeTruthy();

      expect(
        tree.exists('libs/api/my-lib/src/lib/my-lib.controller.spec.ts')
      ).toBeTruthy();
    });
  });
});
