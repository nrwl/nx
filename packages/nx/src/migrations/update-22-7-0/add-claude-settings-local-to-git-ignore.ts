import { Tree } from '../../generators/tree';
import { addEntryToGitIgnore } from '../../utils/ignore';

export default function addClaudeSettingsLocalToGitIgnore(tree: Tree) {
  if (!tree.exists('.gitignore')) {
    return;
  }
  // Lerna users that don't use nx.json may not expect .claude directory changes
  if (tree.exists('lerna.json') && !tree.exists('nx.json')) {
    return;
  }
  addEntryToGitIgnore(tree, '.gitignore', '.claude/settings.local.json');
}
