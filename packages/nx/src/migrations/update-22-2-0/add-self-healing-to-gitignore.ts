import { Tree } from '../../generators/tree';
import ignore = require('ignore');

export default async function addSelfHealingToGitignore(tree: Tree) {
  updateGitIgnore(tree);
  updatePrettierIgnore(tree);
}

export function updateGitIgnore(tree: Tree) {
  const gitignore = tree.exists('.gitignore')
    ? tree.read('.gitignore', 'utf-8')
    : '';
  const ig = ignore();
  ig.add(gitignore);

  // If .nx/self-healing is already covered by existing patterns (e.g., .nx, .nx/*, etc.), skip
  if (!ig.ignores('.nx/self-healing')) {
    const updatedLines = gitignore.length
      ? [gitignore, '.nx/self-healing']
      : ['.nx/self-healing'];
    tree.write('.gitignore', updatedLines.join('\n'));
  }
}

export function updatePrettierIgnore(tree: Tree) {
  if (!tree.exists('.prettierignore')) {
    return;
  }

  const prettierignore = tree.read('.prettierignore', 'utf-8');
  const ig = ignore();
  ig.add(prettierignore);

  if (!ig.ignores('.nx/self-healing')) {
    tree.write(
      '.prettierignore',
      [prettierignore, '/.nx/self-healing'].join('\n')
    );
  }
}
