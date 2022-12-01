import type { Tree } from '@nrwl/devkit';
import * as devkit from '@nrwl/devkit';
import {
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { createTreeWithEmptyV1Workspace } from '@nrwl/devkit/testing';
import { karmaProjectGenerator } from './karma-project';
import libraryGenerator from '../library/library';
import { Linter } from '@nrwl/linter';
import { UnitTestRunner } from '../../utils/test-runners';
import applicationGenerator from '../application/application';

describe('karmaProject', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyV1Workspace();

    await libraryGenerator(tree, {
      name: 'lib1',
      buildable: false,
      linter: Linter.EsLint,
      publishable: false,
      simpleModuleName: false,
      skipFormat: false,
      unitTestRunner: UnitTestRunner.None,
    });

    await applicationGenerator(tree, {
      name: 'app1',
      unitTestRunner: UnitTestRunner.None,
    });
  });

  it('should throw when there is already a test target', async () => {
    devkit.updateJson(tree, 'workspace.json', (json) => {
      json.projects['lib1'].architect.test = {};
      return json;
    });

    await expect(
      karmaProjectGenerator(tree, { project: 'lib1' })
    ).rejects.toThrow('"lib1" already has a test target.');
  });

  it('should generate files', async () => {
    expect(tree.exists('karma.conf.js')).toBeFalsy();
    await karmaProjectGenerator(tree, { project: 'lib1' });

    expect(tree.exists('/libs/lib1/karma.conf.js')).toBeTruthy();
    expect(tree.exists('/libs/lib1/tsconfig.spec.json')).toBeTruthy();
    expect(
      tree.read('/libs/lib1/tsconfig.spec.json', 'utf-8')
    ).toMatchSnapshot();
    expect(tree.exists('karma.conf.js')).toBeTruthy();
  });

  it('should generate files and not add polyfills if it is using ng v15 style polyfills', async () => {
    expect(tree.exists('karma.conf.js')).toBeFalsy();
    await karmaProjectGenerator(tree, { project: 'app1' });

    expect(tree.exists('/apps/app1/tsconfig.spec.json')).toBeTruthy();
    expect(
      tree.read('/apps/app1/tsconfig.spec.json', 'utf-8')
    ).toMatchSnapshot();
  });

  it('should generate files and correctly add polyfills if it is using old ng style polyfills', async () => {
    tree.write('apps/app1/src/polyfills.ts', 'import zone.js;');
    const project = readProjectConfiguration(tree, 'app1');
    project.targets.build.options.polyfills = 'apps/app1/src/polyfills.ts';
    updateProjectConfiguration(tree, 'app1', project);

    expect(tree.exists('karma.conf.js')).toBeFalsy();
    await karmaProjectGenerator(tree, { project: 'app1' });

    expect(tree.exists('/apps/app1/tsconfig.spec.json')).toBeTruthy();
    expect(
      tree.read('/apps/app1/tsconfig.spec.json', 'utf-8')
    ).toMatchSnapshot();
  });

  it('should create a karma.conf.js', async () => {
    await karmaProjectGenerator(tree, { project: 'lib1' });

    const karmaConf = tree.read('libs/lib1/karma.conf.js').toString();
    expect(karmaConf).toMatchSnapshot();
  });

  it('should update the project tsconfig.json to reference the tsconfig.spec.json', async () => {
    await karmaProjectGenerator(tree, { project: 'lib1' });

    const tsConfig = devkit.readJson(tree, 'libs/lib1/tsconfig.json');
    expect(tsConfig.references).toContainEqual({
      path: './tsconfig.spec.json',
    });
  });

  it('should format files', async () => {
    jest.spyOn(devkit, 'formatFiles');

    await karmaProjectGenerator(tree, { project: 'lib1' });

    expect(devkit.formatFiles).toHaveBeenCalled();
  });

  describe('library', () => {
    it('should update the workspace config correctly', async () => {
      await karmaProjectGenerator(tree, { project: 'lib1' });

      const workspaceJson = devkit.readJson(tree, 'workspace.json');
      expect(workspaceJson.projects.lib1.architect.test).toEqual({
        builder: '@angular-devkit/build-angular:karma',
        options: {
          tsConfig: 'libs/lib1/tsconfig.spec.json',
          karmaConfig: 'libs/lib1/karma.conf.js',
          polyfills: ['zone.js', 'zone.js/testing'],
        },
      });
    });

    it('should create a tsconfig.spec.json', async () => {
      await karmaProjectGenerator(tree, { project: 'lib1' });

      const tsConfig = devkit.readJson(tree, 'libs/lib1/tsconfig.spec.json');
      expect(tsConfig).toEqual({
        extends: './tsconfig.json',
        compilerOptions: {
          outDir: '../../dist/out-tsc',
          types: ['jasmine', 'node'],
        },
        include: ['**/*.spec.ts', '**/*.test.ts', '**/*.d.ts'],
      });
    });
  });

  describe('applications', () => {
    it('should update the workspace config correctly', async () => {
      await karmaProjectGenerator(tree, { project: 'app1' });

      const workspaceJson = devkit.readJson(tree, 'workspace.json');
      expect(workspaceJson.projects.app1.architect.test).toEqual({
        builder: '@angular-devkit/build-angular:karma',
        options: {
          polyfills: ['zone.js', 'zone.js/testing'],
          tsConfig: 'apps/app1/tsconfig.spec.json',
          karmaConfig: 'apps/app1/karma.conf.js',
          styles: [],
          scripts: [],
          assets: [],
        },
      });
    });

    it('should create a tsconfig.spec.json', async () => {
      await karmaProjectGenerator(tree, { project: 'app1' });

      const tsConfig = devkit.readJson(tree, 'apps/app1/tsconfig.spec.json');
      expect(tsConfig).toEqual({
        extends: './tsconfig.json',
        compilerOptions: {
          outDir: '../../dist/out-tsc',
          types: ['jasmine', 'node'],
        },
        include: ['**/*.spec.ts', '**/*.test.ts', '**/*.d.ts'],
      });
    });

    it('should update the workspace config correctly when using old style ng polyfills', async () => {
      tree.write('apps/app1/src/polyfills.ts', 'import zone.js;');
      const project = readProjectConfiguration(tree, 'app1');
      project.targets.build.options.polyfills = 'apps/app1/src/polyfills.ts';
      updateProjectConfiguration(tree, 'app1', project);

      await karmaProjectGenerator(tree, { project: 'app1' });

      const workspaceJson = devkit.readJson(tree, 'workspace.json');
      expect(workspaceJson.projects.app1.architect.test).toEqual({
        builder: '@angular-devkit/build-angular:karma',
        options: {
          polyfills: 'apps/app1/src/polyfills.ts',
          tsConfig: 'apps/app1/tsconfig.spec.json',
          karmaConfig: 'apps/app1/karma.conf.js',
          styles: [],
          scripts: [],
          assets: [],
        },
      });
    });

    it('should create a tsconfig.spec.json  when using old style ng polyfills', async () => {
      tree.write('apps/app1/src/polyfills.ts', 'import zone.js;');
      const project = readProjectConfiguration(tree, 'app1');
      project.targets.build.options.polyfills = 'apps/app1/src/polyfills.ts';
      updateProjectConfiguration(tree, 'app1', project);

      await karmaProjectGenerator(tree, { project: 'app1' });

      const tsConfig = devkit.readJson(tree, 'apps/app1/tsconfig.spec.json');
      expect(tsConfig).toEqual({
        extends: './tsconfig.json',
        compilerOptions: {
          outDir: '../../dist/out-tsc',
          types: ['jasmine', 'node'],
        },
        files: ['src/polyfills.ts'],
        include: ['**/*.spec.ts', '**/*.test.ts', '**/*.d.ts'],
      });
    });
  });

  describe('--root-project', () => {
    it('should support a project located at the root', async () => {
      await applicationGenerator(tree, {
        name: 'root-app',
        unitTestRunner: UnitTestRunner.None,
        rootProject: true,
      });
      await karmaProjectGenerator(tree, { project: 'root-app' });

      expect(tree.exists('karma.conf.js')).toBe(true);
      expect(tree.read('karma.conf.js', 'utf-8')).toMatchSnapshot();
      expect(tree.exists('tsconfig.spec.json')).toBe(true);
      const { references } = devkit.readJson(tree, 'tsconfig.json');
      expect(references).toContainEqual({
        path: './tsconfig.spec.json',
      });
      const project = devkit.readProjectConfiguration(tree, 'root-app');
      expect(project.targets.test.options).toStrictEqual({
        polyfills: ['zone.js', 'zone.js/testing'],
        tsConfig: 'tsconfig.spec.json',
        karmaConfig: 'karma.conf.js',
        styles: [],
        scripts: [],
        assets: [],
      });
    });

    it('should generate the right karma.conf.js file for a nested project in a workspace with a project at the root', async () => {
      await applicationGenerator(tree, {
        name: 'root-app',
        unitTestRunner: UnitTestRunner.Karma,
        rootProject: true,
      });
      await libraryGenerator(tree, {
        name: 'nested-lib',
        unitTestRunner: UnitTestRunner.None,
      });
      await karmaProjectGenerator(tree, { project: 'nested-lib' });

      expect(tree.exists('libs/nested-lib/karma.conf.js')).toBe(true);
      expect(
        tree.read('libs/nested-lib/karma.conf.js', 'utf-8')
      ).toMatchSnapshot();
    });
  });
});
