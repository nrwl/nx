import {
  formatFiles,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';

import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';

export async function changeNpmScriptExecutor(tree: Tree) {
  forEachExecutorOptions(
    tree,
    '@nrwl/workspace:run-script',
    (currentValue, project, target) => {
      const projectConfig = readProjectConfiguration(tree, project);
      const targetConfig = projectConfig.targets[target];

      targetConfig.executor = 'nx:run-script';

      updateProjectConfiguration(tree, project, projectConfig);
    }
  );

  await formatFiles(tree);
}

export default changeNpmScriptExecutor;
