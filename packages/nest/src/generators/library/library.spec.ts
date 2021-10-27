import type { Tree } from '@nrwl/devkit';
import * as devkit from '@nrwl/devkit';
import { readJson, readProjectConfiguration } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { libraryGenerator } from './library';

describe('lib', () => {
  let tree: Tree;
  const libFileName = 'my-lib';
  const libName = 'myLib';

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    jest.clearAllMocks();
  });

  describe('not nested', () => {
    it('should update workspace.json', async () => {
      await libraryGenerator(tree, { name: libName });

      const workspaceJson = readJson(tree, '/workspace.json');
      expect(workspaceJson.projects[libFileName].root).toEqual(
        `libs/${libFileName}`
      );
      expect(
        workspaceJson.projects[libFileName].architect.build
      ).toBeUndefined();
      expect(workspaceJson.projects[libFileName].architect.lint).toEqual({
        builder: '@nrwl/linter:eslint',
        outputs: ['{options.outputFile}'],
        options: {
          lintFilePatterns: [`libs/${libFileName}/**/*.ts`],
        },
      });
      expect(workspaceJson.projects[libFileName].architect.test).toEqual({
        builder: '@nrwl/jest:jest',
        outputs: [`coverage/libs/${libFileName}`],
        options: {
          jestConfig: `libs/${libFileName}/jest.config.js`,
          passWithNoTests: true,
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

    it('should remove the default file from @nrwl/node:lib', async () => {
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

      console.log(
        tree.read(
          `libs/${libFileName}/src/lib/${libFileName}.controller.spec.ts`,
          'utf-8'
        )
      );

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
      expect(tsconfigJson.exclude).toEqual(['**/*.spec.ts', '**/*.test.ts']);
    });

    it('should generate files', async () => {
      await libraryGenerator(tree, { name: libName });

      expect(tree.exists(`libs/${libFileName}/jest.config.js`)).toBeTruthy();
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
        tree.exists(`libs/${dirFileName}/${libFileName}/jest.config.js`)
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
        executor: '@nrwl/linter:eslint',
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

      const tsconfigJson = readJson(
        tree,
        `/libs/${libFileName}/tsconfig.lib.json`
      );
      expect(tsconfigJson.compilerOptions.strict).toBe(true);
      expect(
        tsconfigJson.compilerOptions.forceConsistentCasingInFileNames
      ).toBe(true);
      expect(tsconfigJson.compilerOptions.noImplicitReturns).toBe(true);
      expect(tsconfigJson.compilerOptions.noFallthroughCasesInSwitch).toBe(
        true
      );
    });

    it('should default to strict false', async () => {
      await libraryGenerator(tree, { name: libName });

      const tsconfigJson = readJson(
        tree,
        `/libs/${libFileName}/tsconfig.lib.json`
      );
      expect(tsconfigJson.compilerOptions.strict).not.toBeDefined();
      expect(
        tsconfigJson.compilerOptions.forceConsistentCasingInFileNames
      ).not.toBeDefined();
      expect(tsconfigJson.compilerOptions.noImplicitReturns).not.toBeDefined();
      expect(
        tsconfigJson.compilerOptions.noFallthroughCasesInSwitch
      ).not.toBeDefined();
    });
  });

  describe('--unit-test-runner none', () => {
    it('should not generate test configuration', async () => {
      await libraryGenerator(tree, { name: libName, unitTestRunner: 'none' });

      expect(tree.exists(`libs/${libFileName}/tsconfig.spec.json`)).toBeFalsy();
      expect(tree.exists(`libs/${libFileName}/jest.config.js`)).toBeFalsy();
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

    it('should set target to es2020 in tsconfig.lib.json', async () => {
      await libraryGenerator(tree, { name: libName, target: 'es2020' });

      const tsconfigJson = readJson(
        tree,
        `libs/${libFileName}/tsconfig.lib.json`
      );
      expect(tsconfigJson.compilerOptions.target).toEqual('es2020');
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
        tree.read(`libs/${libFileName}/jest.config.js`, 'utf-8')
      ).toMatchSnapshot();
    });

    it('should set target jest testEnvironment to jsdom', async () => {
      await libraryGenerator(tree, { name: libName, testEnvironment: 'jsdom' });

      expect(
        tree.read(`libs/${libFileName}/jest.config.js`, 'utf-8')
      ).toMatchSnapshot();
    });
  });

  describe('--experimentalSwc', () => {
    it('should set  build.options.experimentalSwc to true for buildable', async () => {
      await libraryGenerator(tree, {
        name: libName,
        experimentalSwc: true,
        buildable: true,
      });

      const workspaceJson = readJson(tree, '/workspace.json');
      const project = workspaceJson.projects[libFileName];
      const buildTarget = project.architect.build;
      expect(buildTarget.options.experimentalSwc).toEqual(true);
    });
  });
});
