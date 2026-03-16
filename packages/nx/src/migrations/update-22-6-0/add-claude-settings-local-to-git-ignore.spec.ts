import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import { Tree } from '../../generators/tree';
import addClaudeSettingsLocalToGitIgnore from './add-claude-settings-local-to-git-ignore';

describe('add-claude-settings-local-to-git-ignore migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should not create .gitignore if it does not exist', async () => {
    tree.delete('.gitignore');

    await addClaudeSettingsLocalToGitIgnore(tree);

    expect(tree.exists('.gitignore')).toBe(false);
  });

  it('should add .claude/settings.local.json to existing .gitignore', async () => {
    tree.write('.gitignore', 'node_modules\ndist\n');

    await addClaudeSettingsLocalToGitIgnore(tree);

    const gitignore = tree.read('.gitignore')?.toString();
    expect(gitignore).toContain('node_modules');
    expect(gitignore).toContain('.claude/settings.local.json');
  });

  it('should not duplicate if .claude/settings.local.json is already present', async () => {
    tree.write('.gitignore', 'node_modules\n.claude/settings.local.json\n');

    await addClaudeSettingsLocalToGitIgnore(tree);

    const gitignore = tree.read('.gitignore')?.toString();
    const matches = gitignore.match(/\.claude\/settings\.local\.json/g);
    expect(matches).toHaveLength(1);
  });

  it('should not add if a broader pattern already covers it', async () => {
    tree.write('.gitignore', '.claude/\n');

    await addClaudeSettingsLocalToGitIgnore(tree);

    const gitignore = tree.read('.gitignore')?.toString();
    expect(gitignore).not.toContain('.claude/settings.local.json');
  });

  it('should skip for lerna workspaces without nx.json', async () => {
    tree.write('.gitignore', 'node_modules\n');
    tree.write('lerna.json', '{}');
    tree.delete('nx.json');

    await addClaudeSettingsLocalToGitIgnore(tree);

    const gitignore = tree.read('.gitignore')?.toString();
    expect(gitignore).not.toContain('.claude/settings.local.json');
  });

  it('should not skip for lerna workspaces that also have nx.json', async () => {
    tree.write('.gitignore', 'node_modules\n');
    tree.write('lerna.json', '{}');
    // nx.json already exists from createTreeWithEmptyWorkspace

    await addClaudeSettingsLocalToGitIgnore(tree);

    const gitignore = tree.read('.gitignore')?.toString();
    expect(gitignore).toContain('.claude/settings.local.json');
  });
});
