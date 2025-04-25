import {
  formatFiles,
  type ProjectConfiguration,
  readNxJson,
  readProjectConfiguration,
  type TargetConfiguration,
  type Tree,
  updateNxJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import type { CypressExecutorOptions } from '../../executors/cypress/cypress.impl';

const EXECUTOR_TO_MIGRATE = '@nx/cypress:cypress';

export default async function (tree: Tree) {
  // update options from project configs
  forEachExecutorOptions<CypressExecutorOptions>(
    tree,
    EXECUTOR_TO_MIGRATE,
    (options, project, target, configuration) => {
      if (options.tsConfig === undefined && options.copyFiles === undefined) {
        return;
      }

      const projectConfiguration = readProjectConfiguration(tree, project);
      if (configuration) {
        updateConfiguration(
          projectConfiguration.targets[target],
          configuration
        );
      } else {
        updateOptions(projectConfiguration.targets[target]);
      }

      updateProjectConfiguration(tree, project, projectConfiguration);
    }
  );

  // update options from nx.json target defaults
  const nxJson = readNxJson(tree);
  if (nxJson.targetDefaults) {
    for (const [targetOrExecutor, targetConfig] of Object.entries(
      nxJson.targetDefaults
    )) {
      if (
        targetOrExecutor !== EXECUTOR_TO_MIGRATE &&
        targetConfig.executor !== EXECUTOR_TO_MIGRATE
      ) {
        continue;
      }

      if (targetConfig.options) {
        updateOptions(targetConfig);
      }

      Object.keys(targetConfig.configurations ?? {}).forEach((config) => {
        updateConfiguration(targetConfig, config);
      });

      if (
        !Object.keys(targetConfig).length ||
        (Object.keys(targetConfig).length === 1 &&
          Object.keys(targetConfig)[0] === 'executor')
      ) {
        delete nxJson.targetDefaults[targetOrExecutor];
      }

      if (!Object.keys(nxJson.targetDefaults).length) {
        delete nxJson.targetDefaults;
      }
    }

    updateNxJson(tree, nxJson);
  }

  await formatFiles(tree);
}

function updateOptions(target: TargetConfiguration) {
  delete target.options.tsConfig;
  delete target.options.copyFiles;

  if (!Object.keys(target.options).length) {
    delete target.options;
  }
}

function updateConfiguration(
  target: TargetConfiguration,
  configuration: string
) {
  delete target.configurations[configuration].tsConfig;
  delete target.configurations[configuration].copyFiles;
  if (
    !Object.keys(target.configurations[configuration]).length &&
    (!target.defaultConfiguration ||
      target.defaultConfiguration !== configuration)
  ) {
    delete target.configurations[configuration];
  }
  if (!Object.keys(target.configurations).length) {
    delete target.configurations;
  }
}
