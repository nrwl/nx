import { readJson, Tree } from '@nrwl/devkit';
import { updateBabelJestConfig } from './update-babel-jest-config';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

describe('updateBabelJestConfig', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should update babel-jest.config.json', async () => {
    tree.write('/apps/demo/babel-jest.config.json', JSON.stringify({}));

    updateBabelJestConfig(tree, '/apps/demo', (json) => {
      json.plugins = ['test'];
      return json;
    });

    const config = readJson(tree, '/apps/demo/babel-jest.config.json');
    expect(config.plugins).toEqual(['test']);
  });

  it('should do nothing if project does not use babel jest', async () => {
    updateBabelJestConfig(tree, '/apps/demo', (json) => {
      json.plugins = ['test'];
      return json;
    });
    expect(tree.exists('/apps/demo/babel-jest.config.json')).toBe(false);
  });
});
