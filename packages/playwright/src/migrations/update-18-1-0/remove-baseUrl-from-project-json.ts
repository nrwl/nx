import {
  formatFiles,
  readNxJson,
  readProjectConfiguration,
  type Tree,
  updateNxJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';

export default async function (tree: Tree) {
  forEachExecutorOptions(
    tree,
    '@nx/playwright:playwright',
    (options, projectName, targetName, configurationName) => {
      if (options?.['baseUrl']) {
        const project = readProjectConfiguration(tree, projectName);
        if (configurationName) {
          delete project.targets[targetName].configurations[configurationName][
            'baseUrl'
          ];
        } else {
          delete project.targets[targetName].options['baseUrl'];
        }

        updateProjectConfiguration(tree, projectName, project);
      }
    }
  );

  const nxJson = readNxJson(tree);
  for (const [targetNameOrExecutor, target] of Object.entries(
    nxJson.targetDefaults
  )) {
    if (
      targetNameOrExecutor === '@nx/playwright:playwright' ||
      (target.executor && target.executor === '@nx/playwright:playwright')
    ) {
      let updated = false;
      if (target.options?.['baseUrl']) {
        delete nxJson.targetDefaults[targetNameOrExecutor].options['baseUrl'];
        updated = true;
      }

      if (target.configurations) {
        for (const [configurationName, configuration] of Object.entries(
          target.configurations
        )) {
          if (configuration['baseUrl']) {
            delete nxJson.targetDefaults[targetNameOrExecutor].configurations[
              configurationName
            ]['baseUrl'];
            updated = true;
          }
        }
      }

      if (updated) {
        updateNxJson(tree, nxJson);
      }
    }
  }

  await formatFiles(tree);
}
