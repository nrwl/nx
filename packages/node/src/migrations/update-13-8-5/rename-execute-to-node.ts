import {
  formatFiles,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';

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
