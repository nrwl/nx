import type { Tree } from '@nrwl/devkit';
import * as devkit from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { karmaProjectGenerator } from './karma-project';
import libraryGenerator from '../library/library';
import { Linter } from '@nrwl/linter';
import { UnitTestRunner } from '../../utils/test-runners';
import applicationGenerator from '../application/application';

describe('karmaProject', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();

    await libraryGenerator(tree, {
      name: 'lib1',
      buildable: false,
      enableIvy: false,
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
    await karmaProjectGenerator(tree, { project: 'lib1' });

    expect(tree.exists('/libs/lib1/karma.conf.js')).toBeTruthy();
    expect(tree.exists('/libs/lib1/tsconfig.spec.json')).toBeTruthy();
    expect(tree.exists('/libs/lib1/src/test.ts')).toBeTruthy();
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
          main: 'libs/lib1/src/test.ts',
          tsConfig: 'libs/lib1/tsconfig.spec.json',
          karmaConfig: 'libs/lib1/karma.conf.js',
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
        files: ['src/test.ts'],
        include: ['**/*.spec.ts', '**/*.d.ts'],
      });
    });

    it('should create a test.ts', async () => {
      await karmaProjectGenerator(tree, { project: 'lib1' });

      const testTs = tree.read('libs/lib1/src/test.ts').toString();
      expect(testTs).toMatchSnapshot();
    });
  });

  describe('applications', () => {
    it('should update the workspace config correctly', async () => {
      await karmaProjectGenerator(tree, { project: 'app1' });

      const workspaceJson = devkit.readJson(tree, 'workspace.json');
      expect(workspaceJson.projects.app1.architect.test).toEqual({
        builder: '@angular-devkit/build-angular:karma',
        options: {
          main: 'apps/app1/src/test.ts',
          polyfills: 'apps/app1/src/polyfills.ts',
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
        files: ['src/test.ts', 'src/polyfills.ts'],
        include: ['**/*.spec.ts', '**/*.d.ts'],
      });
    });

    it('should create a test.ts', async () => {
      await karmaProjectGenerator(tree, { project: 'app1' });

      const testTs = tree.read('apps/app1/src/test.ts').toString();
      expect(testTs).toMatchSnapshot();
    });
  });
});
