import {
  addProjectConfiguration,
  readJson,
  updateJson,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import addSvgrWebpackIfUsed from './add-svgr-webpack-if-used';

describe('add-svgr-webpack-if-used migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies = { '@nx/next': '23.1.0' };
      return json;
    });
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: { build: { executor: '@nx/next:build' } },
    });
  });

  it('should not add @svgr/webpack when no next config references it', async () => {
    tree.write('apps/app1/next.config.js', 'module.exports = {};');

    await addSvgrWebpackIfUsed(tree);

    expect(readJson(tree, 'package.json').devDependencies).toEqual({
      '@nx/next': '23.1.0',
    });
  });

  it('should add @svgr/webpack when a next config resolves it', async () => {
    tree.write(
      'apps/app1/next.config.js',
      `const loader = require.resolve('@svgr/webpack');`
    );

    await addSvgrWebpackIfUsed(tree);

    expect(
      readJson(tree, 'package.json').devDependencies['@svgr/webpack']
    ).toBeDefined();
  });

  it('should check other next config extensions', async () => {
    tree.write('apps/app1/next.config.mjs', `const loader = '@svgr/webpack';`);

    await addSvgrWebpackIfUsed(tree);

    expect(
      readJson(tree, 'package.json').devDependencies['@svgr/webpack']
    ).toBeDefined();
  });

  it('should leave an already installed @svgr/webpack untouched', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies['@svgr/webpack'] = '^7.0.0';
      return json;
    });
    tree.write(
      'apps/app1/next.config.js',
      `const loader = require.resolve('@svgr/webpack');`
    );

    await addSvgrWebpackIfUsed(tree);

    expect(
      readJson(tree, 'package.json').devDependencies['@svgr/webpack']
    ).toBe('^7.0.0');
  });
});
