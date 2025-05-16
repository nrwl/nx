import { createTree } from '../../generators/testing-utils/create-tree';
import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import migrate from './move-cache-directory';

describe('move-cache-directory', () => {
  it('should add .nx/cache to the gitignore', () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write('.gitignore', 'node_modules');
    migrate(tree);
    expect(tree.read('.gitignore', 'utf-8')).toMatchInlineSnapshot(`
      "node_modules
      .nx/cache"
    `);
  });

  it('should work if .gitignore is not present', () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.delete('.gitignore');
    migrate(tree);
    expect(tree.read('.gitignore', 'utf-8')).toMatchInlineSnapshot(
      `".nx/cache"`
    );
  });

  it('should not change gitignore if directly ignored', () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write('.gitignore', 'node_modules\n.nx/cache');
    migrate(tree);
    expect(tree.read('.gitignore', 'utf-8')).toMatchInlineSnapshot(`
      "node_modules
      .nx/cache"
    `);
  });

  it('should not change gitignore if ignored by another pattern', () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write('.gitignore', 'node_modules\n.*/cache');
    migrate(tree);
    expect(tree.read('.gitignore', 'utf-8')).toMatchInlineSnapshot(`
      "node_modules
      .*/cache"
    `);
  });

  it('should not update gitignore for lerna repos without nx.json', () => {
    const tree = createTree();
    tree.write('.gitignore', 'node_modules');
    tree.write('lerna.json', '{}');
    migrate(tree);
    expect(tree.read('.gitignore', 'utf-8')).toMatchInlineSnapshot(
      `"node_modules"`
    );
  });

  it('should handle prettierignore', () => {
    const tree = createTree();
    tree.write('.prettierignore', '/dist');
    migrate(tree);
    expect(tree.read('.prettierignore', 'utf-8')).toMatchInlineSnapshot(`
      "/dist
      /.nx/cache"
    `);
  });

  it('should handle missing prettierignore', () => {
    const tree = createTree();
    tree.delete('.prettierignore');
    migrate(tree);
    expect(tree.exists('.prettierignore')).toBeFalsy();
  });
});
