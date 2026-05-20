import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import { Tree } from '../../generators/tree';
import addMigrateRunsToGitIgnore from './add-migrate-runs-to-git-ignore';

describe('add-migrate-runs-to-git-ignore migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add .nx/migrate-runs to existing .gitignore', async () => {
    tree.write('.gitignore', 'node_modules\ndist\n');

    await addMigrateRunsToGitIgnore(tree);

    expect(tree.read('.gitignore')?.toString()).toContain('.nx/migrate-runs');
  });

  it('should not create .gitignore if it does not exist', async () => {
    tree.delete('.gitignore');

    await addMigrateRunsToGitIgnore(tree);

    expect(tree.exists('.gitignore')).toBe(false);
  });

  it('should skip for lerna workspaces without nx.json', async () => {
    tree.write('.gitignore', 'node_modules\n');
    tree.write('lerna.json', '{}');
    tree.delete('nx.json');

    await addMigrateRunsToGitIgnore(tree);

    expect(tree.read('.gitignore')?.toString()).not.toContain('.nx/migrate-runs');
  });

  it('should not skip for lerna workspaces that also have nx.json', async () => {
    tree.write('.gitignore', 'node_modules\n');
    tree.write('lerna.json', '{}');
    // nx.json already exists from createTreeWithEmptyWorkspace

    await addMigrateRunsToGitIgnore(tree);

    expect(tree.read('.gitignore')?.toString()).toContain('.nx/migrate-runs');
  });
});
