import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import { Tree } from '../../generators/tree';
import addClaudeWorktreesToGitIgnore from './add-claude-worktrees-to-git-ignore';

describe('add-claude-worktrees-to-git-ignore migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should not create .gitignore if it does not exist', async () => {
    tree.delete('.gitignore');

    await addClaudeWorktreesToGitIgnore(tree);

    expect(tree.exists('.gitignore')).toBe(false);
  });

  it('should add .claude/worktrees to existing .gitignore', async () => {
    tree.write('.gitignore', 'node_modules\ndist\n');

    await addClaudeWorktreesToGitIgnore(tree);

    const gitignore = tree.read('.gitignore')?.toString();
    expect(gitignore).toContain('node_modules');
    expect(gitignore).toContain('.claude/worktrees');
  });

  it('should not duplicate if .claude/worktrees is already present', async () => {
    tree.write('.gitignore', 'node_modules\n.claude/worktrees\n');

    await addClaudeWorktreesToGitIgnore(tree);

    const gitignore = tree.read('.gitignore')?.toString();
    const matches = gitignore.match(/\.claude\/worktrees/g);
    expect(matches).toHaveLength(1);
  });

  it('should not add if a broader pattern already covers it', async () => {
    tree.write('.gitignore', '.claude/\n');

    await addClaudeWorktreesToGitIgnore(tree);

    const gitignore = tree.read('.gitignore')?.toString();
    expect(gitignore).not.toContain('.claude/worktrees');
  });

  it('should skip for lerna workspaces without nx.json', async () => {
    tree.write('.gitignore', 'node_modules\n');
    tree.write('lerna.json', '{}');
    tree.delete('nx.json');

    await addClaudeWorktreesToGitIgnore(tree);

    const gitignore = tree.read('.gitignore')?.toString();
    expect(gitignore).not.toContain('.claude/worktrees');
  });

  it('should not skip for lerna workspaces that also have nx.json', async () => {
    tree.write('.gitignore', 'node_modules\n');
    tree.write('lerna.json', '{}');
    // nx.json already exists from createTreeWithEmptyWorkspace

    await addClaudeWorktreesToGitIgnore(tree);

    const gitignore = tree.read('.gitignore')?.toString();
    expect(gitignore).toContain('.claude/worktrees');
  });
});
