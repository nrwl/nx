import 'nx/src/internal-testing-utils/mock-project-graph';

import { readJson, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/eslint';
import { applicationGenerator } from '../application/application';
import { libraryGenerator } from '../library/library';
import { reduxGenerator } from './redux';

describe('redux', () => {
  let appTree: Tree;

  beforeEach(async () => {
    appTree = createTreeWithEmptyWorkspace();
    await libraryGenerator(appTree, {
      directory: 'my-lib',
      linter: Linter.EsLint,
      skipFormat: true,
      skipTsConfig: false,
      style: 'css',
      unitTestRunner: 'jest',
    });
  });

  it('should add dependencies', async () => {
    await reduxGenerator(appTree, {
      name: 'my-slice',
      path: 'my-lib/src/lib/my-slice/my-slice',
    });

    const packageJson = readJson(appTree, '/package.json');
    expect(packageJson.dependencies['@reduxjs/toolkit']).toBeDefined();
    expect(packageJson.dependencies['react-redux']).toBeDefined();
  });

  it('should add slice and spec files', async () => {
    await reduxGenerator(appTree, {
      name: 'my-slice',
      path: 'my-lib/src/lib/my-slice/',
    });

    expect(appTree.exists('/my-lib/src/lib/my-slice.slice.ts')).toBeTruthy();
    expect(
      appTree.exists('/my-lib/src/lib/my-slice.slice.spec.ts')
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
        directory: 'my-app',
      });
      await reduxGenerator(appTree, {
        name: 'my-slice',
        path: 'my-lib/src/lib/my-slice/my-slice',
        appProject: 'my-app',
      });
      await reduxGenerator(appTree, {
        name: 'another-slice',
        path: 'my-lib/src/lib/another-slice/another-slice',
        appProject: 'my-app',
      });
      await reduxGenerator(appTree, {
        name: 'third-slice',
        path: 'my-lib/src/lib/third-slice/third-slice',
        appProject: 'my-app',
      });

      const main = appTree.read('/my-app/src/main.tsx', 'utf-8');
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
          path: 'my-lib/src/lib/my-slice/my-slice',
          appProject: 'my-lib',
        })
      ).rejects.toThrow(/Expected m/);
    });
  });
});
