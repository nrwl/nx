import 'nx/src/internal-testing-utils/mock-project-graph';

import { readJson, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { webpackInitGenerator } from './init';

describe('webpackInitGenerator', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should install plugin and webpack-cli', async () => {
    await webpackInitGenerator(tree, {
      addPlugin: true,
    });

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson).toEqual({
      name: expect.any(String),
      dependencies: {},
      devDependencies: {
        '@nx/webpack': expect.any(String),
        '@nx/web': expect.any(String),
        'webpack-cli': expect.any(String),
      },
    });
  });
});
