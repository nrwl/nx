import { addProjectConfiguration, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';

describe('forEachExecutorOptions', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'proj1', {
      root: 'proj1',
      targets: {
        a: {
          executor: 'builder1',
          options: {
            builder1Option: 0,
          },
          configurations: {
            production: {
              builder1Option: 1,
            },
          },
        },
      },
    });
    addProjectConfiguration(tree, 'proj2', {
      root: 'proj2',
      targets: {
        a: {
          executor: 'builder2',
          options: {
            builder2Option: 0,
          },
          configurations: {
            production: {
              builder2Option: 1,
            },
          },
        },
      },
    });

    // configuration with no targets at all which is not valid
    // but should not break the iteration over target configs
    addProjectConfiguration(tree, 'proj3', {
      root: 'proj3',
    } as any);
  });

  it('should call a function for all options', () => {
    const callback = jest.fn();

    forEachExecutorOptions(tree, 'builder1', callback);

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalledWith(
      {
        builder1Option: 0,
      },
      'proj1',
      'a'
    );
    expect(callback).toHaveBeenCalledWith(
      {
        builder1Option: 1,
      },
      'proj1',
      'a',
      'production'
    );
    expect(callback).not.toHaveBeenCalledWith(
      {
        builder2Option: 0,
      },
      'proj2',
      'a'
    );
    expect(callback).not.toHaveBeenCalledWith(
      {
        builder2Option: 1,
      },
      'proj2',
      'a',
      'production'
    );
  });
});
