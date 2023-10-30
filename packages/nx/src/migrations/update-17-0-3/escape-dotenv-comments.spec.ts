import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import { Tree } from '../../generators/tree';

import update from './escape-dotenv-comments';

describe('escape dotenv # values', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should update values that start with a #', () => {
    tree.write('.env', 'foo=#bar');
    update(tree);
    expect(tree.read('.env').toString()).toEqual("foo='#bar'");
  });

  it("shouldn't update values that are already escaped", () => {
    tree.write('.env', "foo='#bar'");
    update(tree);
    expect(tree.read('.env').toString()).toEqual("foo='#bar'");
  });

  it("shouldn't mess up existing comments", () => {
    tree.write('.env', 'foo=#value # foo=bar');
    update(tree);
    expect(tree.read('.env').toString()).toEqual("foo='#value' # foo=bar");
  });
});
