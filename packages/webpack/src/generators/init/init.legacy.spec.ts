import { readJson, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { webpackInitGenerator } from './init';

describe('webpackInitGenerator (legacy)', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should not install webpack dependencies', async () => {
    await webpackInitGenerator(tree, {
      addPlugin: false,
    });

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
