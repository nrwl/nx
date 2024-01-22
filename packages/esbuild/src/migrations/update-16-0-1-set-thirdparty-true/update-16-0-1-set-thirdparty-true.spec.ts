import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  addProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';

import update from './update-16-0-1-set-thirdparty-true';

describe('update-16-0-1-set-thirdparty-true', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should skip migration targets are not set on the project', async () => {
    addProjectConfiguration(tree, 'myapp', {
      root: 'myapp',
    });
    await update(tree);

    const config = readProjectConfiguration(tree, 'myapp');

    expect(config.targets).toBeUndefined();
  });

  it('should add thirdParty property if bundling is enabled implicitly', async () => {
    addProjectConfiguration(tree, 'myapp', {
      root: 'myapp',
      targets: {
        build: {
          executor: '@nx/esbuild:esbuild',
        },
      },
    });
    await update(tree);

    const config = readProjectConfiguration(tree, 'myapp');

    expect(config.targets.build.options).toEqual({
      thirdParty: true,
    });
  });

  it('should add thirdParty property if bundling is enabled explicitly', async () => {
    addProjectConfiguration(tree, 'myapp', {
      root: 'myapp',
      targets: {
        build: {
          executor: '@nx/esbuild:esbuild',
          options: {
            bundle: true,
          },
        },
      },
    });
    await update(tree);

    const config = readProjectConfiguration(tree, 'myapp');

    expect(config.targets.build.options).toEqual({
      bundle: true,
      thirdParty: true,
    });
  });

  it('should not add thirdParty property if bundling is disabled', async () => {
    addProjectConfiguration(tree, 'myapp', {
      root: 'myapp',
      targets: {
        build: {
          executor: '@nx/esbuild:esbuild',
          options: {
            bundle: false,
          },
        },
      },
    });
    await update(tree);

    const config = readProjectConfiguration(tree, 'myapp');

    expect(config.targets.build.options).toEqual({
      bundle: false,
    });
  });

  it('should not set thirdParty property if it was already set', async () => {
    addProjectConfiguration(tree, 'myapp', {
      root: 'myapp',
      targets: {
        build: {
          executor: '@nx/esbuild:esbuild',
          options: {
            thirdParty: false,
          },
        },
      },
    });
    await update(tree);

    const config = readProjectConfiguration(tree, 'myapp');

    expect(config.targets.build.options).toEqual({
      thirdParty: false,
    });
  });
});
