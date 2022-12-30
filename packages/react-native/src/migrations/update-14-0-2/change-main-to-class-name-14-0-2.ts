import {
  formatFiles,
  getProjects,
  logger,
  names,
  stripIndents,
  Tree,
} from '@nrwl/devkit';
import { join } from 'path';

/**
 * This function changes "main" tag to project's className
 */
export default async function update(tree: Tree) {
  const projects = getProjects(tree);

  for (const [name, config] of projects.entries()) {
    if (config.targets?.start?.executor !== '@nrwl/react-native:start')
      continue;
    let mailFilePath;
    if (tree.exists(join(config.root, 'src/main.tsx'))) {
      mailFilePath = join(config.root, 'src/main.tsx');
    }
    if (tree.exists(join(config.root, 'src/main.js'))) {
      mailFilePath = join(config.root, 'src/main.js');
    }
    if (!mailFilePath) {
      continue;
    }
    try {
      const { className } = names(name);
      const content = tree.read(mailFilePath, 'utf-8');
      if (!content.includes(`'main'`)) {
        return;
      }
      tree.write(mailFilePath, content.replace(`'main'`, `'${className}'`));
    } catch {
      logger.error(
        stripIndents`Unable to update ${mailFilePath} for project ${name}.`
      );
    }
  }

  await formatFiles(tree);
}
