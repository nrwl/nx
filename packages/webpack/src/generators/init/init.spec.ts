import '@nx/devkit/internal-testing-utils/mock-project-graph';

import { readJson, Tree, updateJson } from '@nx/devkit';
import { withPnpm } from '@nx/devkit/internal-testing-utils';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { webpackInitGenerator } from './init';

describe('webpackInitGenerator', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should deny the @parcel/watcher build script pulled in by sass', async () => {
    await withPnpm(tree, '11.2.2', () =>
      webpackInitGenerator(tree, { addPlugin: true })
    );

    expect(tree.read('pnpm-workspace.yaml', 'utf-8')).toMatch(
      /['"]@parcel\/watcher['"]: false/
    );
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
