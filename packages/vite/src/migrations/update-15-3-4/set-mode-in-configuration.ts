import {
  formatFiles,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';

export async function setModeInConfiguration(tree: Tree) {
  forAllProjectsUsingViteAddMode(tree);
  await formatFiles(tree);
}

export default setModeInConfiguration;

function forAllProjectsUsingViteAddMode(tree: Tree): void {
  forEachExecutorOptions(
    tree,
    '@nrwl/vite:build',
    (_options, projectName, targetName, configuration) => {
      if (!configuration) {
        return;
      }

      const projectConfiguration = readProjectConfiguration(tree, projectName);
      projectConfiguration.targets[targetName].configurations[
        configuration
      ].mode ??= configuration;

      updateProjectConfiguration(tree, projectName, {
        ...projectConfiguration,
      });
    }
  );
}
