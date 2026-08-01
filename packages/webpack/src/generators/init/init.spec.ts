import 'nx/src/internal-testing-utils/mock-project-graph';

import { readJson, Tree, updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { webpackInitGenerator } from './init';

describe('webpackInitGenerator', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should install plugin, webpack, webpack-dev-server, and webpack-cli', async () => {
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
        webpack: expect.any(String),
        'webpack-dev-server': expect.any(String),
        'webpack-cli': expect.any(String),
      },
    });
  });

  it('should not overwrite an already-installed webpack version', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies = {
        ...(json.devDependencies ?? {}),
        webpack: '5.50.0',
      };
      return json;
    });

    await webpackInitGenerator(tree, {
      addPlugin: true,
    });

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['webpack']).toBe('5.50.0');
  });
});
