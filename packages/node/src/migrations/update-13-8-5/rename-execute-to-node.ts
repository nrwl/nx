import {
  formatFiles,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';

export default async function update(tree: Tree) {
  forEachExecutorOptions(
    tree,
    '@nrwl/node:execute',
    (_, projectName, targetName) => {
      const projectConfiguration = readProjectConfiguration(tree, projectName);
      projectConfiguration.targets[targetName].executor = '@nrwl/node:node';
      updateProjectConfiguration(tree, projectName, projectConfiguration);
    }
  );

  await formatFiles(tree);
}
