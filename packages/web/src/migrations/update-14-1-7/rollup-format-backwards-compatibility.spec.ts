import { addProjectConfiguration, readJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import update from './rollup-format-backwards-compatibility';

describe('rollup-format-backwards-compatibility', () => {
  it('should add format options to match previous behavior if it does not exist', async () => {
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'proj1', {
      root: 'proj1',
      targets: {
        build: {
          executor: '@nrwl/web:rollup',
        },
      },
    });

    await update(tree);

    expect(readJson(tree, 'proj1/project.json').targets).toEqual({
      build: {
        executor: '@nrwl/web:rollup',
        options: {
          format: ['esm', 'cjs'],
        },
      },
    });
  });

  it('should skip update if format exists', async () => {
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'proj1', {
      root: 'proj1',
      targets: {
        build: {
          executor: '@nrwl/web:rollup',
          options: {
            format: ['esm'],
          },
        },
      },
    });

    await update(tree);

    expect(readJson(tree, 'proj1/project.json').targets).toEqual({
      build: {
        executor: '@nrwl/web:rollup',
        options: {
          format: ['esm'],
        },
      },
    });
  });
});
