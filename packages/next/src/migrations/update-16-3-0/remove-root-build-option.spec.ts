import update from './remove-root-build-option';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing-pre16';
import {
  addProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';

describe('remove-root-build-option', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should remove the root option from the build target for @nx/next:build executor', async () => {
    addProjectConfiguration(tree, 'my-app', {
      root: 'my-app',
      targets: {
        build: {
          executor: '@nx/next:build',
          options: {
            root: 'my-app',
          },
        },
      },
    });

    await update(tree);

    const updatedConfig = readProjectConfiguration(tree, 'my-app');
    expect(updatedConfig.targets.build.options.root).toBeUndefined();
  });

  it('should remove the root option from the build target for @nrwl/next:build executor', async () => {
    addProjectConfiguration(tree, 'my-app', {
      root: 'my-app',
      targets: {
        build: {
          executor: '@nrwl/next:build',
          options: {
            root: 'my-app',
          },
        },
      },
    });

    await update(tree);

    const updatedConfig = readProjectConfiguration(tree, 'my-app');
    expect(updatedConfig.targets.build.options.root).toBeUndefined();
  });

  it('should leave other executors alone', async () => {
    addProjectConfiguration(tree, 'my-app', {
      root: 'my-app',
      targets: {
        build: {
          executor: '@acme/foo:bar',
          options: {
            root: 'my-app',
          },
        },
      },
    });

    await update(tree);

    const updatedConfig = readProjectConfiguration(tree, 'my-app');
    expect(updatedConfig.targets.build.options.root).toEqual('my-app');
  });
});
