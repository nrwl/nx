import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import { Tree } from '../../generators/tree';
import addMigrateRunsToGitIgnore from './add-migrate-runs-to-git-ignore';

describe('add-migrate-runs-to-git-ignore migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should not create .gitignore if it does not exist', async () => {
    tree.delete('.gitignore');

    await addMigrateRunsToGitIgnore(tree);

    expect(tree.exists('.gitignore')).toBe(false);
  });

  it('should add .nx/migrate-runs to existing .gitignore', async () => {
    tree.write('.gitignore', 'node_modules\ndist\n');

    await addMigrateRunsToGitIgnore(tree);

    const gitignore = tree.read('.gitignore')?.toString();
    expect(gitignore).toContain('node_modules');
    expect(gitignore).toContain('.nx/migrate-runs');
  });

  it('should not duplicate if .nx/migrate-runs is already present', async () => {
    tree.write('.gitignore', 'node_modules\n.nx/migrate-runs\n');

    await addMigrateRunsToGitIgnore(tree);

    const gitignore = tree.read('.gitignore')?.toString();
    const matches = gitignore.match(/\.nx\/migrate-runs/g);
    expect(matches).toHaveLength(1);
  });

  it('should not add if a broader pattern already covers it', async () => {
    tree.write('.gitignore', '.nx/\n');

    await addMigrateRunsToGitIgnore(tree);

    const gitignore = tree.read('.gitignore')?.toString();
    expect(gitignore).not.toContain('.nx/migrate-runs');
  });

  it('should skip for lerna workspaces without nx.json', async () => {
    tree.write('.gitignore', 'node_modules\n');
    tree.write('lerna.json', '{}');
    tree.delete('nx.json');

    await addMigrateRunsToGitIgnore(tree);

    const gitignore = tree.read('.gitignore')?.toString();
    expect(gitignore).not.toContain('.nx/migrate-runs');
  });

  it('should not skip for lerna workspaces that also have nx.json', async () => {
    tree.write('.gitignore', 'node_modules\n');
    tree.write('lerna.json', '{}');
    // nx.json already exists from createTreeWithEmptyWorkspace

    await addMigrateRunsToGitIgnore(tree);

    const gitignore = tree.read('.gitignore')?.toString();
    expect(gitignore).toContain('.nx/migrate-runs');
  });
});
