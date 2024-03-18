import type { ServerBuilderOptions } from '@angular-devkit/build-angular';
import type { Tree } from '@nx/devkit';
import {
  formatFiles,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';

const executors = [
  '@angular-devkit/build-angular:server',
  '@nx/angular:server',
  '@nrwl/angular:server',
];

export default async function (tree: Tree) {
  executors.forEach((executor) => {
    forEachExecutorOptions<ServerBuilderOptions>(
      tree,
      executor,
      (_options, projectName, targetName, configurationName) => {
        const projectConfiguration = readProjectConfiguration(
          tree,
          projectName
        );
        const configToUpdate: ServerBuilderOptions = configurationName
          ? projectConfiguration.targets[targetName].configurations[
              configurationName
            ]
          : projectConfiguration.targets[targetName].options;

        if (
          configToUpdate.buildOptimizer === undefined &&
          configToUpdate.optimization !== undefined
        ) {
          configToUpdate.buildOptimizer = !!configToUpdate.optimization;
        }

        updateProjectConfiguration(tree, projectName, projectConfiguration);
      }
    );
  });

  await formatFiles(tree);
}
