import { forEachExecutorOptions } from '@nx/devkit/internal';
import {
  formatFiles,
  readNxJson,
  readProjectConfiguration,
  updateNxJson,
  updateProjectConfiguration,
  type Tree,
} from '@nx/devkit';

export const executors = ['@nx/angular:ng-packagr-lite', '@nx/angular:package'];

export default async function (tree: Tree) {
  // update options from project configs
  executors.forEach((executor) => {
    forEachExecutorOptions<{ tailwindConfig?: string }>(
      tree,
      executor,
      (options, project, target, configuration) => {
        if (options.tailwindConfig === undefined) {
          return;
        }

        const projectConfiguration = readProjectConfiguration(tree, project);
        if (configuration) {
          const config =
            projectConfiguration.targets[target].configurations[configuration];
          delete config.tailwindConfig;
          if (!Object.keys(config).length) {
            delete projectConfiguration.targets[target].configurations[
              configuration
            ];
          }
          if (
            !Object.keys(projectConfiguration.targets[target].configurations)
              .length
          ) {
            delete projectConfiguration.targets[target].configurations;
          }
        } else {
          const config = projectConfiguration.targets[target].options;
          delete config.tailwindConfig;
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

  const cleanEntry = (
    targetConfig: Record<string, any>
  ): { empty: boolean } => {
    if (targetConfig.options) {
      delete targetConfig.options.tailwindConfig;
      if (!Object.keys(targetConfig.options).length) {
        delete targetConfig.options;
      }
    }

    Object.entries(targetConfig.configurations ?? {}).forEach(
      ([name, config]: [string, any]) => {
        delete config.tailwindConfig;
        if (!Object.keys(config).length) {
          delete targetConfig.configurations[name];
        }
      }
    );

    if (!Object.keys(targetConfig.configurations ?? {}).length) {
      delete targetConfig.configurations;
    }

    return {
      empty:
        !Object.keys(targetConfig).length ||
        (Object.keys(targetConfig).length === 1 &&
          Object.keys(targetConfig)[0] === 'executor'),
    };
  };

  for (const [targetOrExecutor, targetConfig] of Object.entries(
    nxJson.targetDefaults
  )) {
    if (Array.isArray(targetConfig)) {
      // This migration predates the filtered array value form; values are plain objects here.
      continue;
    }

    if (
      !executors.includes(targetOrExecutor) &&
      !executors.includes(targetConfig.executor)
    ) {
      continue;
    }

    const { empty } = cleanEntry(targetConfig as any);
    if (empty) {
      delete nxJson.targetDefaults[targetOrExecutor];
    }

    if (!Object.keys(nxJson.targetDefaults).length) {
      delete nxJson.targetDefaults;
    }
  }

  updateNxJson(tree, nxJson);

  await formatFiles(tree);
}
