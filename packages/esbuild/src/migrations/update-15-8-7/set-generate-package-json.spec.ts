import {
  addProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './set-generate-package-json';

describe('Migration: Set generatePackageJson', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should keep existing generatePackageJson option if it exists', async () => {
    addProjectConfiguration(tree, 'myapp', {
      root: 'myapp',
      targets: {
        build: {
          executor: '@nrwl/esbuild:esbuild',
          options: {
            generatePackageJson: false,
          },
        },
      },
    });

    await update(tree);

    const config = readProjectConfiguration(tree, 'myapp');

    expect(config.targets.build.options).toEqual({
      generatePackageJson: false,
    });
  });

  it('should set generatePackageJson to true for esbuild targets', async () => {
    addProjectConfiguration(tree, 'myapp', {
      root: 'myapp',
      targets: {
        build: {
          executor: '@nrwl/esbuild:esbuild',
        },
      },
    });

    await update(tree);

    const config = readProjectConfiguration(tree, 'myapp');

    expect(config.targets.build.options).toEqual({
      generatePackageJson: true,
    });
  });

  it('should ignore targets not using esbuild', async () => {
    addProjectConfiguration(tree, 'myapp', {
      root: 'myapp',
      targets: {
        build: {
          executor: '@nrwl/webpack:webpack',
        },
      },
    });

    await update(tree);

    const config = readProjectConfiguration(tree, 'myapp');

    expect(config.targets.build.options).toBeUndefined();
  });
});
