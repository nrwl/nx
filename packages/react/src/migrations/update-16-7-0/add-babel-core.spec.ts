import { Tree, readJson, updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import addBabelCore from './add-babel-core';

describe('update-16-7-0-add-babel-core', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add @babel/core to package.json', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies['@babel/preset-react'] = '*';
      return json;
    });

    await addBabelCore(tree);

    expect(
      readJson(tree, 'package.json').devDependencies['@babel/core']
    ).toBeDefined();
  });

  it('should not add @babel/core to package.json if preset-react is not available', async () => {
    await addBabelCore(tree);

    expect(
      readJson(tree, 'package.json').devDependencies['@babel/core']
    ).not.toBeDefined();
  });
});
