import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import { Tree } from '../../generators/tree';
import { readNxJson, updateNxJson } from '../../generators/utils/nx-json';

import update from './move-default-base';

describe('update-17.1.0 migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it("shouldn't do anything if affected.defaultBase is not set", () => {
    tree.write('nx.json', JSON.stringify({}));
    update(tree);
    expect(readNxJson(tree)).toEqual({});
  });

  it("shouldn't remove affected if other keys present", () => {
    updateNxJson(tree, {
      affected: {
        defaultBase: 'master',
        otherKey: 'otherValue',
      } as any,
    });
    update(tree);
    expect(readNxJson(tree)).toEqual({
      affected: {
        otherKey: 'otherValue',
      },
      defaultBase: 'master',
    });
  });

  it('should remove affected if no other keys present', () => {
    updateNxJson(tree, {
      affected: {
        defaultBase: 'master',
      } as any,
    });
    update(tree);
    expect(readNxJson(tree)).toEqual({
      defaultBase: 'master',
    });
  });
});
