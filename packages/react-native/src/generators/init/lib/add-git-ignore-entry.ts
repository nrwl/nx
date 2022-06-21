import { logger, Tree } from '@nrwl/devkit';
import ignore from 'ignore';
import { gitIgnoreEntriesForReactNative } from './gitignore-entries';

export function addGitIgnoreEntry(host: Tree) {
  if (!host.exists('.gitignore')) {
    logger.warn(`Couldn't find .gitignore file to update`);
    return;
  }

  let content = host.read('.gitignore', 'utf-8').trimEnd();

  const ig = ignore();
  ig.add(host.read('.gitignore', 'utf-8'));

  if (!ig.ignores('apps/example/ios/Pods/Folly')) {
    content = `${content}\n${gitIgnoreEntriesForReactNative}\n`;
  }

  // also ignore nested node_modules folders due to symlink for React Native
  if (!ig.ignores('apps/example/node_modules')) {
    content = `${content}\n## Nested node_modules\n\nnode_modules/\n`;
  }

  host.write('.gitignore', content);
}
