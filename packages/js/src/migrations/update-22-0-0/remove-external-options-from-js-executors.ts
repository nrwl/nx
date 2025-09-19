import {
  formatFiles,
  readNxJson,
  readProjectConfiguration,
  updateNxJson,
  updateProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';

export const executors = ['@nx/js:swc', '@nx/js:tsc'];

export default async function (tree: Tree) {
  // update options from project configs
  executors.forEach((executor) => {
    forEachExecutorOptions<{ external?: any; externalBuildTargets?: string[] }>(
      tree,
      executor,
      (options, project, target, configuration) => {
        if (
          options.external === undefined &&
          options.externalBuildTargets === undefined
        ) {
          return;
        }

        const projectConfiguration = readProjectConfiguration(tree, project);
        if (configuration) {
          const config =
            projectConfiguration.targets[target].configurations[configuration];
          delete config.external;
          delete config.externalBuildTargets;
        } else {
          const config = projectConfiguration.targets[target].options;
          delete config.external;
          delete config.externalBuildTargets;
          if (!Object.keys(config).length) {
            delete projectConfiguration.targets[target].options;
          }
        }

        updateProjectConfiguration(tree, project, projectConfiguration);
      }
    );
  });

  // update options from nx.json target defaults
  const nxJson = readNxJson(tree);
  if (!nxJson.targetDefaults) {
    return;
  }

  for (const [targetOrExecutor, targetConfig] of Object.entries(
    nxJson.targetDefaults
  )) {
    if (
      !executors.includes(targetOrExecutor) &&
      !executors.includes(targetConfig.executor)
    ) {
      continue;
    }

    if (targetConfig.options) {
      delete targetConfig.options.external;
      delete targetConfig.options.externalBuildTargets;
      if (!Object.keys(targetConfig.options).length) {
        delete targetConfig.options;
      }
    }

    Object.entries(targetConfig.configurations ?? {}).forEach(([, config]) => {
      delete config.external;
      delete config.externalBuildTargets;
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

  await formatFiles(tree);
}
