import {
  formatFiles,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { RollupExecutorOptions } from '../../executors/rollup/schema';

export default async function (tree: Tree) {
  forEachExecutorOptions<RollupExecutorOptions>(
    tree,
    '@nx/rollup:rollup',
    (
      options: RollupExecutorOptions,
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
