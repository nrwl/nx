import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { readJsonInTree } from '@nrwl/workspace';
import { runSchematic } from '../../utils/testing';

describe('lib', () => {
  let appTree: Tree;

  beforeEach(async () => {
    appTree = Tree.empty();
    appTree = createEmptyWorkspace(appTree);
    appTree = await runSchematic('lib', { name: 'my-lib' }, appTree);
  });

  it('should add dependencies', async () => {
    const tree = await runSchematic(
      'redux',
      { name: 'my-slice', project: 'my-lib' },
      appTree
    );
    const packageJson = readJsonInTree(tree, '/package.json');
    expect(packageJson.dependencies['redux-starter-kit']).toBeDefined();
    expect(packageJson.dependencies['react-redux']).toBeDefined();
  });

  it('should add slice and spec files', async () => {
    const tree = await runSchematic(
      'redux',
      { name: 'my-slice', project: 'my-lib' },
      appTree
    );

    expect(tree.exists('/libs/my-lib/src/lib/my-slice.slice.ts')).toBeTruthy();
    expect(
      tree.exists('/libs/my-lib/src/lib/my-slice.slice.spec.ts')
    ).toBeTruthy();
  });

  describe('--appProject', () => {
    it('should configure app main', async () => {
      appTree = await runSchematic('app', { name: 'my-app' }, appTree);
      let tree = await runSchematic(
        'redux',
        { name: 'my-slice', project: 'my-lib', appProject: 'my-app' },
        appTree
      );
      tree = await runSchematic(
        'redux',
        { name: 'another-slice', project: 'my-lib', appProject: 'my-app' },
        tree
      );
      tree = await runSchematic(
        'redux',
        { name: 'third-slice', project: 'my-lib', appProject: 'my-app' },
        tree
      );

      const main = tree.read('/apps/my-app/src/main.tsx').toString();
      expect(main).toContain('redux-starter-kit');
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
        runSchematic(
          'redux',
          { name: 'my-slice', project: 'my-lib', appProject: 'my-lib' },
          appTree
        )
      ).rejects.toThrow(/Expected m/);
    });
  });
});
