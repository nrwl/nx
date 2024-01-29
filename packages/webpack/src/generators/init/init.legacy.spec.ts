import { readJson, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { webpackInitGenerator } from './init';

describe('webpackInitGenerator (legacy)', () => {
  let tree: Tree;
  let previousEnv: string | undefined;

  beforeEach(async () => {
    previousEnv = process.env.NX_ADD_PLUGINS;
    process.env.NX_ADD_PLUGINS = 'false';
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  afterEach(() => {
    process.env.NX_ADD_PLUGINS = previousEnv;
  });

  it('should not install webpack dependencies', async () => {
    await webpackInitGenerator(tree, {});

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson).toEqual({
      name: expect.any(String),
      dependencies: {},
      devDependencies: {
        '@nx/web': expect.any(String),
        '@nx/webpack': expect.any(String),
      },
    });
  });
});
