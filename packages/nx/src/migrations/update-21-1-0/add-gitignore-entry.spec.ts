import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import addGitignoreEntry from './add-gitignore-entry';

describe('addGitignoreEntry migration', () => {
  it('should add .cursor/rules/nx-rules.mdc and .github/instructions/nx.instructions.md to .gitignore if not present', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write('.gitignore', 'dist\nnode_modules\n');
    await addGitignoreEntry(tree);
    const result = tree.read('.gitignore', 'utf-8');
    expect(result).toContain('.cursor/rules/nx-rules.mdc');
    expect(result).toContain('.github/instructions/nx.instructions.md');
  });

  it('should not add duplicate entries if already present', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      '.gitignore',
      'dist\n.cursor/rules/nx-rules.mdc\n.github/instructions/nx.instructions.md\n'
    );
    await addGitignoreEntry(tree);
    const result = tree.read('.gitignore', 'utf-8');
    expect(result.match(/\.cursor\/rules\/nx-rules\.mdc/g)?.length).toBe(1);
    expect(
      result.match(/\.github\/instructions\/nx\.instructions\.md/g)?.length
    ).toBe(1);
  });

  it('should do nothing if .gitignore does not exist', async () => {
    const tree = createTreeWithEmptyWorkspace();
    await addGitignoreEntry(tree);
    expect(tree.exists('.gitignore')).toBe(false);
  });
});
