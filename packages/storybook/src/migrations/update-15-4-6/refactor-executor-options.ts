import {
  formatFiles,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';

export default async function (tree: Tree) {
  updateNonAngularStorybookBuildTargets(tree);
  updateNonAngularStorybookServeTargets(tree);
  await formatFiles(tree);
}

function updateNonAngularStorybookBuildTargets(tree: Tree) {
  forEachExecutorOptions(
    tree,
    '@nrwl/storybook:build',
    (_options, projectName, targetName, configuration) => {
      if (!configuration) {
        return;
      }
      const projectConfiguration = readProjectConfiguration(tree, projectName);

      if (!projectConfiguration.targets[targetName].options) {
        projectConfiguration.targets[targetName].options = {};
      }

      if (!projectConfiguration.targets[targetName].options.configDir) {
        projectConfiguration.targets[targetName].options.configDir =
          projectConfiguration.targets[targetName].options.config?.configFolder;
      }

      if (!projectConfiguration.targets[targetName].options.outputDir) {
        projectConfiguration.targets[targetName].options.outputDir =
          projectConfiguration.targets[targetName].options.outputPath;
      }

      if (!projectConfiguration.targets[targetName].options.docs) {
        projectConfiguration.targets[targetName].options.docs =
          projectConfiguration.targets[targetName].options.docsMode;
      }

      projectConfiguration.targets[targetName].outputs =
        projectConfiguration.targets[targetName].outputs?.map(
          (output: string) =>
            output.replace('{options.outputPath}', '{options.outputDir}')
        );

      delete projectConfiguration.targets[targetName].options.config;
      delete projectConfiguration.targets[targetName].options.outputPath;
      delete projectConfiguration.targets[targetName].options.docsMode;

      updateProjectConfiguration(tree, projectName, {
        ...projectConfiguration,
      });
    }
  );
}

function updateNonAngularStorybookServeTargets(tree: Tree) {
  forEachExecutorOptions(
    tree,
    '@nrwl/storybook:storybook',
    (_options, projectName, targetName, configuration) => {
      if (!configuration) {
        return;
      }

      const projectConfiguration = readProjectConfiguration(tree, projectName);

      if (!projectConfiguration.targets[targetName].options) {
        projectConfiguration.targets[targetName].options = {};
      }

      if (!projectConfiguration.targets[targetName].options.configDir) {
        projectConfiguration.targets[targetName].options.configDir =
          projectConfiguration.targets[targetName].options.config?.configFolder;
      }

      if (!projectConfiguration.targets[targetName].options.docs) {
        projectConfiguration.targets[targetName].options.docs =
          projectConfiguration.targets[targetName].options.docsMode;
      }

      delete projectConfiguration.targets[targetName].options.config;
      delete projectConfiguration.targets[targetName].options.docsMode;

      updateProjectConfiguration(tree, projectName, {
        ...projectConfiguration,
      });
    }
  );
}
