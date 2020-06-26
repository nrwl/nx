import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { readJsonInTree } from '@nrwl/workspace';
import { updateBabelJestConfig } from './update-babel-jest-config';
import { callRule } from '@nrwl/workspace/src/utils/testing';

describe('updateBabelJestConfig', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = Tree.empty();
    tree = createEmptyWorkspace(tree);
  });

  it('should update babel-jest.config.json', async () => {
    tree.create('/apps/demo/babel-jest.config.json', JSON.stringify({}));

    tree = await callRule(
      updateBabelJestConfig('/apps/demo', (json) => {
        json.plugins = ['test'];
        return json;
      }),
      tree
    );

    const config = readJsonInTree(tree, '/apps/demo/babel-jest.config.json');
    expect(config.plugins).toEqual(['test']);
  });

  it('should do nothing if project does not use babel jest', async () => {
    tree = await callRule(
      updateBabelJestConfig('/apps/demo', (json) => {
        json.plugins = ['test'];
        return json;
      }),
      tree
    );

    expect(tree.exists('/apps/demo/babel-jest.config.json')).toBe(false);
  });
});
