import { readJson, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { webpackInitGenerator } from './init';

describe('webpackInitGenerator (PCv3)', () => {
  let tree: Tree;
  let previousEnv: string | undefined;

  beforeEach(async () => {
    previousEnv = process.env.NX_PCV3;
    process.env.NX_PCV3 = 'true';
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  afterEach(() => {
    process.env.NX_PCV3 = previousEnv;
  });

  it('should install webpack-cli', async () => {
    await webpackInitGenerator(tree, {});

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson).toEqual({
      name: expect.any(String),
      dependencies: {},
      devDependencies: {
        '@nx/webpack': expect.any(String),
        'webpack-cli': expect.any(String),
      },
    });
  });
});
