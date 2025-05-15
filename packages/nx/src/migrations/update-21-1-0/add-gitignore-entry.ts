import { Tree } from '../../generators/tree';
import ignore from 'ignore';

export default async function addGitignoreEntry(tree: Tree) {
  const GITIGNORE_ENTRIES = [
    '.cursor/rules/nx-rules.mdc',
    '.github/instructions/nx.instructions.md',
  ];
  if (!tree.exists('.gitignore')) {
    return;
  }
  let content = tree.read('.gitignore', 'utf-8') || '';
  const ig = ignore().add(content);
  for (const entry of GITIGNORE_ENTRIES) {
    if (!ig.ignores(entry)) {
      content = content.trimEnd() + '\n' + entry + '\n';
    }
  }
  tree.write('.gitignore', content);
}
