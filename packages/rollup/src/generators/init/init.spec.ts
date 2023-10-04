import { Tree, readJson, NxJsonConfiguration, updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { nxVersion } from '../../utils/versions';

import { rollupInitGenerator } from './init';

describe('rollupInitGenerator', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should support swc', async () => {
    await rollupInitGenerator(tree, { compiler: 'swc' });

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson).toEqual({
      name: expect.any(String),
      dependencies: {},
      devDependencies: {
        '@nx/rollup': nxVersion,
        '@swc/helpers': expect.any(String),
        '@swc/core': expect.any(String),
        'swc-loader': expect.any(String),
      },
    });
  });

  it('should support tsc', async () => {
    await rollupInitGenerator(tree, { compiler: 'tsc' });

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson).toEqual({
      name: expect.any(String),
      dependencies: {},
      devDependencies: {
        '@nx/rollup': nxVersion,
        tslib: expect.any(String),
      },
    });
  });
});
