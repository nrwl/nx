import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import { Tree } from '../../generators/tree';
import addPolygraphToGitIgnore from './add-polygraph-to-git-ignore';

describe('add-polygraph-to-git-ignore migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should not create .gitignore if it does not exist', async () => {
    tree.delete('.gitignore');

    await addPolygraphToGitIgnore(tree);

    expect(tree.exists('.gitignore')).toBe(false);
  });

  it('should add .nx/polygraph to existing .gitignore', async () => {
    tree.write('.gitignore', 'node_modules\ndist\n');

    await addPolygraphToGitIgnore(tree);

    const gitignore = tree.read('.gitignore')?.toString();
    expect(gitignore).toContain('node_modules');
    expect(gitignore).toContain('.nx/polygraph');
  });

  it('should not duplicate if .nx/polygraph is already present', async () => {
    tree.write('.gitignore', 'node_modules\n.nx/polygraph\n');

    await addPolygraphToGitIgnore(tree);

    const gitignore = tree.read('.gitignore')?.toString();
    const matches = gitignore.match(/\.nx\/polygraph/g);
    expect(matches).toHaveLength(1);
  });

  it('should not add if a broader pattern already covers it', async () => {
    tree.write('.gitignore', '.nx/\n');

    await addPolygraphToGitIgnore(tree);

    const gitignore = tree.read('.gitignore')?.toString();
    expect(gitignore).not.toContain('.nx/polygraph');
  });

  it('should skip for lerna workspaces without nx.json', async () => {
    tree.write('.gitignore', 'node_modules\n');
    tree.write('lerna.json', '{}');
    tree.delete('nx.json');

    await addPolygraphToGitIgnore(tree);

    const gitignore = tree.read('.gitignore')?.toString();
    expect(gitignore).not.toContain('.nx/polygraph');
  });

  it('should not skip for lerna workspaces that also have nx.json', async () => {
    tree.write('.gitignore', 'node_modules\n');
    tree.write('lerna.json', '{}');
    // nx.json already exists from createTreeWithEmptyWorkspace

    await addPolygraphToGitIgnore(tree);

    const gitignore = tree.read('.gitignore')?.toString();
    expect(gitignore).toContain('.nx/polygraph');
  });
});
