import { logger, Tree } from '@nrwl/devkit';
import ignore from 'ignore';
import { gitIgnoreEntriesForReactNative } from './gitignore-entries';

export function addGitIgnoreEntry(host: Tree) {
  if (!host.exists('.gitignore')) {
    logger.warn(`Couldn't find .gitignore file to update`);
    return;
  }

  let content = host.read('.gitignore')?.toString('utf-8').trimRight();

  const ig = ignore();
  ig.add(host.read('.gitignore').toString());

  if (!ig.ignores('apps/example/ios/Pods/Folly')) {
    content = `${content}\n${gitIgnoreEntriesForReactNative}\n`;
  }

  host.write('.gitignore', content);
}
