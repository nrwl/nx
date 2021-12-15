import { readJson, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { applicationGenerator, libraryGenerator } from '@nrwl/react';
import { Linter } from '@nrwl/linter';
import { reduxGenerator } from './redux';

describe('redux', () => {
  let appTree: Tree;

  beforeEach(async () => {
    appTree = createTreeWithEmptyWorkspace();
    await libraryGenerator(appTree, {
      name: 'my-lib',
      linter: Linter.EsLint,
      skipFormat: false,
      skipTsConfig: false,
      style: 'css',
      unitTestRunner: 'jest',
      standaloneConfig: false,
    });
  });

  it('should add dependencies', async () => {
    await reduxGenerator(appTree, {
      name: 'my-slice',
      project: 'my-lib',
    });

    const packageJson = readJson(appTree, '/package.json');
    expect(packageJson.dependencies['@reduxjs/toolkit']).toBeDefined();
    expect(packageJson.dependencies['react-redux']).toBeDefined();
  });

  it('should add slice and spec files', async () => {
    await reduxGenerator(appTree, {
      name: 'my-slice',
      project: 'my-lib',
    });

    expect(
      appTree.exists('/libs/my-lib/src/lib/my-slice.slice.ts')
    ).toBeTruthy();
    expect(
      appTree.exists('/libs/my-lib/src/lib/my-slice.slice.spec.ts')
    ).toBeTruthy();
  });

  describe('--appProject', () => {
    it('should configure app main', async () => {
      await applicationGenerator(appTree, {
        e2eTestRunner: 'none',
        linter: Linter.EsLint,
        skipFormat: true,
        style: 'css',
        unitTestRunner: 'none',
        name: 'my-app',
        standaloneConfig: false,
      });
      await reduxGenerator(appTree, {
        name: 'my-slice',
        project: 'my-lib',
        appProject: 'my-app',
      });
      await reduxGenerator(appTree, {
        name: 'another-slice',
        project: 'my-lib',
        appProject: 'my-app',
      });
      await reduxGenerator(appTree, {
        name: 'third-slice',
        project: 'my-lib',
        appProject: 'my-app',
      });

      const main = appTree.read('/apps/my-app/src/main.tsx', 'utf-8');
      expect(main).toContain('@reduxjs/toolkit');
      expect(main).toContain('configureStore');
      expect(main).toContain('[THIRD_SLICE_FEATURE_KEY]: thirdSliceReducer,');
      expect(main).toContain(
        '[ANOTHER_SLICE_FEATURE_KEY]: anotherSliceReducer,'
      );
      expect(main).toContain('[MY_SLICE_FEATURE_KEY]: mySliceReducer');
      expect(main).toMatch(/<Provider store={store}>/);
    });

    it('should throw error for lib project', async () => {
      await expect(
        reduxGenerator(appTree, {
          name: 'my-slice',
          project: 'my-lib',
          appProject: 'my-lib',
        })
      ).rejects.toThrow(/Expected m/);
    });
  });
});
