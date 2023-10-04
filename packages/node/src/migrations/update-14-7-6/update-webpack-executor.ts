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
    '@nrwl/node:webpack',
    (options, projectName, targetName) => {
      const projectConfig = readProjectConfiguration(tree, projectName);
      projectConfig.targets[targetName].executor = '@nrwl/webpack:webpack';
      projectConfig.targets[targetName].options.compiler = 'tsc';
      projectConfig.targets[targetName].options.target = 'node';
      updateProjectConfiguration(tree, projectName, projectConfig);
    }
  );

  await formatFiles(tree);
}
