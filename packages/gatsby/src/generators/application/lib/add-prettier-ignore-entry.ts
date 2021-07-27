import { logger, Tree } from '@nrwl/devkit';
import { NormalizedSchema } from './normalize-options';

export function addPrettierIgnoreEntry(host: Tree, options: NormalizedSchema) {
  if (host.exists('.prettierignore')) {
    let content = host.read('.prettierignore', 'utf-8');
    content = `${content}\n/apps/${options.projectName}/node_modules\n/apps/${options.projectName}/public\n/apps/${options.projectName}/.cache\n`;
    host.write('.prettierignore', content);
  } else {
    logger.warn(`Couldn't find .prettierignore file to update`);
  }
}
