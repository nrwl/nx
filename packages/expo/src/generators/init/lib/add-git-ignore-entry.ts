import { logger, Tree } from '@nx/devkit';
import { gitIgnoreEntriesForExpo } from './gitignore-entries';

export function addGitIgnoreEntry(host: Tree) {
  if (!host.exists('.gitignore')) {
    logger.warn(`Couldn't find .gitignore file to update`);
    return;
  }

  let content = host.read('.gitignore')?.toString('utf-8').trimEnd();

  if (!/\.expo\/$/gm.test(content)) {
    content = `${content}\n${gitIgnoreEntriesForExpo}\n`;
  }

  host.write('.gitignore', content);
}
