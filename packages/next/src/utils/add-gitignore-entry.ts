import { Tree } from 'nx/src/generators/tree';
import ignore from 'ignore';

export function addGitIgnoreEntry(host: Tree) {
  if (!host.exists('.gitignore')) {
    return;
  }

  let content = host.read('.gitignore', 'utf-8').trimEnd();

  const ig = ignore();
  ig.add(host.read('.gitignore', 'utf-8'));

  if (!ig.ignores('apps/example/.next')) {
    content = `${content}\n\n# Next.js\n.next\n`;
  }

  host.write('.gitignore', content);
}
