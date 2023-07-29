import { Tree, readJson, NxJsonConfiguration, updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { webpackInitGenerator } from './init';

describe('webpackInitGenerator', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should support swc', async () => {
    await webpackInitGenerator(tree, { compiler: 'swc' });

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson).toEqual({
      name: expect.any(String),
      dependencies: {
        '@swc/helpers': expect.any(String),
      },
      devDependencies: {
        '@nx/webpack': expect.any(String),
        '@swc/cli': expect.any(String),
        '@swc/core': expect.any(String),
        'swc-loader': expect.any(String),
      },
    });
  });

  it('should support tsc', async () => {
    await webpackInitGenerator(tree, { compiler: 'tsc' });

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson).toEqual({
      name: expect.any(String),
      dependencies: {},
      devDependencies: {
        '@nx/webpack': expect.any(String),
        tslib: expect.any(String),
      },
    });
  });
});
