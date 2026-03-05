import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import { Tree } from '../../generators/tree';
import addClaudeWorktreesToGitIgnore from './add-claude-worktrees-to-git-ignore';

describe('add-claude-worktrees-to-git-ignore migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should not create .gitignore if it does not exist', () => {
    tree.delete('.gitignore');

    addClaudeWorktreesToGitIgnore(tree);

    expect(tree.exists('.gitignore')).toBe(false);
  });

  it('should add .claude/worktrees to existing .gitignore', () => {
    tree.write('.gitignore', 'node_modules\ndist\n');

    addClaudeWorktreesToGitIgnore(tree);

    const gitignore = tree.read('.gitignore')?.toString();
    expect(gitignore).toContain('node_modules');
    expect(gitignore).toContain('.claude/worktrees');
  });

  it('should not duplicate if .claude/worktrees is already present', () => {
    tree.write('.gitignore', 'node_modules\n.claude/worktrees\n');

    addClaudeWorktreesToGitIgnore(tree);

    const gitignore = tree.read('.gitignore')?.toString();
    const matches = gitignore.match(/\.claude\/worktrees/g);
    expect(matches).toHaveLength(1);
  });

  it('should not add if a broader pattern already covers it', () => {
    tree.write('.gitignore', '.claude/\n');

    addClaudeWorktreesToGitIgnore(tree);

    const gitignore = tree.read('.gitignore')?.toString();
    expect(gitignore).not.toContain('.claude/worktrees');
  });

  it('should skip for lerna workspaces without nx.json', () => {
    tree.write('.gitignore', 'node_modules\n');
    tree.write('lerna.json', '{}');
    tree.delete('nx.json');

    addClaudeWorktreesToGitIgnore(tree);

    const gitignore = tree.read('.gitignore')?.toString();
    expect(gitignore).not.toContain('.claude/worktrees');
  });

  it('should not skip for lerna workspaces that also have nx.json', () => {
    tree.write('.gitignore', 'node_modules\n');
    tree.write('lerna.json', '{}');
    // nx.json already exists from createTreeWithEmptyWorkspace

    addClaudeWorktreesToGitIgnore(tree);

    const gitignore = tree.read('.gitignore')?.toString();
    expect(gitignore).toContain('.claude/worktrees');
  });
});
