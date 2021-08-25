import { createTree } from '@nrwl/devkit/testing';
import { readJson, Tree, writeJson } from '@nrwl/devkit';
import moveExtendsIntoOverrides from '@nrwl/angular/src/migrations/update-12-9-0/move-extends-into-overrides';

describe('moveExtendsIntoOverrides', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTree();
    writeJson(tree, '.eslintrc.json', {});
  });

  it('should change configs that have extends', async () => {
    writeJson(tree, 'proj/.eslintrc.json', {
      extends: '../.eslintrc.json',
      overrides: [
        {
          extends: 'some-config',
        },
        {
          extends: ['some-config'],
        },
        {},
      ],
    });
    await moveExtendsIntoOverrides(tree);
    expect(readJson(tree, 'proj/.eslintrc.json')).toEqual({
      overrides: [
        {
          extends: ['some-config', '../.eslintrc.json'],
        },
        {
          extends: ['some-config', '../.eslintrc.json'],
        },
        {
          extends: ['../.eslintrc.json'],
        },
      ],
    });
  });

  it('should not change configs without extends', async () => {
    writeJson(tree, 'proj/.eslintrc.json', {});
    await moveExtendsIntoOverrides(tree);
    expect(readJson(tree, 'proj/.eslintrc.json')).toEqual({});
  });
});
