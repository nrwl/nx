import { logger, Tree } from '@nx/devkit';
import { gitIgnoreEntriesForExpo } from './gitignore-entries';

export function addGitIgnoreEntry(host: Tree) {
  const gitignore = host.read('.gitignore', 'utf-8');
  if (gitignore === null) {
    logger.warn(`Couldn't find .gitignore file to update`);
    return;
  }

  let content = gitignore.trimEnd();

  if (!/\.expo\/$/gm.test(content)) {
    content = `${content}\n${gitIgnoreEntriesForExpo}\n`;
  }

  host.write('.gitignore', content);
}
