import {
  addProjectConfiguration,
  ProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { updateRollupExecutor } from './update-rollup-executor';

describe('updateRollupExecutor', () => {
  it('should migrate projects using @nrwl/web:rollup to @nrwl/rollup:rollup', async () => {
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'proj1', {
      root: 'proj1',
      targets: {
        build: { executor: '@nrwl/esbuild:esbuild' },
      },
    });
    addProjectConfiguration(tree, 'proj2', {
      root: 'proj2',
      targets: {
        build: { executor: '@nrwl/web:rollup' },
      },
    });
    addProjectConfiguration(tree, 'proj3', {
      root: 'proj3',
      targets: {
        build: { executor: '@nrwl/webpack:webpack' },
      },
    });

    updateRollupExecutor(tree);

    expect(readProjectConfiguration(tree, 'proj1')).toMatchObject({
      targets: {
        build: { executor: '@nrwl/esbuild:esbuild' },
      },
    });
    expect(readProjectConfiguration(tree, 'proj2')).toMatchObject({
      targets: {
        build: { executor: '@nrwl/rollup:rollup' },
      },
    });
    expect(readProjectConfiguration(tree, 'proj3')).toMatchObject({
      targets: {
        build: { executor: '@nrwl/webpack:webpack' },
      },
    });
  });
});
