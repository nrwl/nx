import {
  formatFiles,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { WebpackExecutorOptions } from '../../executors/webpack/schema';

export default async function (tree: Tree) {
  forEachExecutorOptions<WebpackExecutorOptions>(
    tree,
    '@nrwl/webpack:webpack',
    (
      options: WebpackExecutorOptions,
      projectName,
      targetName,
      _configurationName
    ) => {
      if (options.babelUpwardRootMode !== undefined) {
        return;
      }

      const projectConfiguration = readProjectConfiguration(tree, projectName);
      projectConfiguration.targets[targetName].options.babelUpwardRootMode =
        true;
      updateProjectConfiguration(tree, projectName, projectConfiguration);
    }
  );

  await formatFiles(tree);
}
