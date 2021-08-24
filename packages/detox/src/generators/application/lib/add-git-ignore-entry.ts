import { logger, Tree } from '@nrwl/devkit';
import { NormalizedSchema } from './normalize-options';

export function addGitIgnoreEntry(host: Tree, options: NormalizedSchema) {
  if (host.exists('.gitignore')) {
    let content = host.read('.gitignore', 'utf-8');
    content = `${content}\n${options.projectRoot}/artifacts\n`;
    host.write('.gitignore', content);
  } else {
    logger.warn(`Couldn't find .gitignore file to update`);
  }
}
