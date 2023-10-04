import {
  formatFiles,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';

export default async function update(tree: Tree) {
  const migrateProject = (_options, projectName, targetName) => {
    const projectConfig = readProjectConfiguration(tree, projectName);
    projectConfig.targets[targetName].executor = '@nx/js:node';
    updateProjectConfiguration(tree, projectName, projectConfig);
  };

  forEachExecutorOptions(tree, '@nx/node:node', migrateProject);

  await formatFiles(tree);
}
