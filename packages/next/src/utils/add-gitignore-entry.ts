import ignore from 'ignore';
import { Tree } from '@nx/devkit';

export function addGitIgnoreEntry(host: Tree) {
  const gitignore = host.read('.gitignore', 'utf-8');
  if (gitignore === null) {
    return;
  }

  let content = gitignore.trimEnd();

  const ig = ignore();
  ig.add(gitignore);

  if (!ig.ignores('apps/example/.next')) {
    content = `${content}\n\n# Next.js\n.next\nout\n`;
  }

  host.write('.gitignore', content);
}
