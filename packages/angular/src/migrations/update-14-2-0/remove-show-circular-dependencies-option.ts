import {
  formatFiles,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';

const executors = [
  '@angular-devkit/build-angular:browser',
  '@angular-devkit/build-angular:server',
  '@nrwl/angular:webpack-browser',
];

export default async function (tree: Tree) {
  executors.forEach((executor) => {
    forEachExecutorOptions(
      tree,
      executor,
      (_options, projectName, targetName, configurationName) => {
        const projectConfiguration = readProjectConfiguration(
          tree,
          projectName
        );
        const config = configurationName
          ? projectConfiguration.targets[targetName].configurations[
              configurationName
            ]
          : projectConfiguration.targets[targetName].options;
        delete config.showCircularDependencies;
        updateProjectConfiguration(tree, projectName, projectConfiguration);
      }
    );
  });

  await formatFiles(tree);
}
