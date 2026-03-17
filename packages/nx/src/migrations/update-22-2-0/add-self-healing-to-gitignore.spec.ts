import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import { Tree } from '../../generators/tree';
import addSelfHealingToGitignore from './add-self-healing-to-gitignore';

describe('add-self-healing-to-gitignore migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should not create .gitignore if it does not exist', async () => {
    tree.delete('.gitignore');

    await addSelfHealingToGitignore(tree);

    expect(tree.exists('.gitignore')).toBe(false);
  });

  it('should add .nx/self-healing to existing .gitignore', async () => {
    tree.write('.gitignore', 'node_modules\ndist\n');

    await addSelfHealingToGitignore(tree);

    const gitignore = tree.read('.gitignore')?.toString();
    expect(gitignore).toContain('node_modules');
    expect(gitignore).toContain('.nx/self-healing');
  });

  it('should not duplicate if .nx/self-healing is already present', async () => {
    tree.write('.gitignore', 'node_modules\n.nx/self-healing\n');

    await addSelfHealingToGitignore(tree);

    const gitignore = tree.read('.gitignore')?.toString();
    const matches = gitignore.match(/\.nx\/self-healing/g);
    expect(matches).toHaveLength(1);
  });

  it('should not add if a broader pattern already covers it', async () => {
    tree.write('.gitignore', '.nx/\n');

    await addSelfHealingToGitignore(tree);

    const gitignore = tree.read('.gitignore')?.toString();
    expect(gitignore).not.toContain('.nx/self-healing');
  });

  it('should skip for lerna workspaces without nx.json', async () => {
    tree.write('.gitignore', 'node_modules\n');
    tree.write('lerna.json', '{}');
    tree.delete('nx.json');

    await addSelfHealingToGitignore(tree);

    const gitignore = tree.read('.gitignore')?.toString();
    expect(gitignore).not.toContain('.nx/self-healing');
  });

  it('should not skip for lerna workspaces that also have nx.json', async () => {
    tree.write('.gitignore', 'node_modules\n');
    tree.write('lerna.json', '{}');
    // nx.json already exists from createTreeWithEmptyWorkspace

    await addSelfHealingToGitignore(tree);

    const gitignore = tree.read('.gitignore')?.toString();
    expect(gitignore).toContain('.nx/self-healing');
  });

  it('should add .nx/self-healing to .prettierignore if it exists', async () => {
    tree.write('.gitignore', 'node_modules\n');
    tree.write('.prettierignore', '/dist\n');

    await addSelfHealingToGitignore(tree);

    const prettierignore = tree.read('.prettierignore')?.toString();
    expect(prettierignore).toContain('.nx/self-healing');
  });

  it('should not modify .prettierignore if it does not exist', async () => {
    tree.write('.gitignore', 'node_modules\n');

    await addSelfHealingToGitignore(tree);

    expect(tree.exists('.prettierignore')).toBe(false);
  });
});
