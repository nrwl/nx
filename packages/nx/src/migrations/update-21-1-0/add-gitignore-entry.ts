import { Tree } from '../../generators/tree';

export default async function addGitignoreEntry(tree: Tree) {
  const GITIGNORE_ENTRIES = [
    '.cursor/rules/nx-rules.mdc',
    '.github/instructions/nx.instructions.md',
  ];
  if (!tree.exists('.gitignore')) {
    return;
  }
  let content = tree.read('.gitignore', 'utf-8') || '';
  let updated = false;
  for (const entry of GITIGNORE_ENTRIES) {
    if (!content.includes(entry)) {
      content = content.trim() + '\n' + entry + '\n';
      updated = true;
    }
  }
  if (updated) {
    tree.write('.gitignore', content);
  }
}
