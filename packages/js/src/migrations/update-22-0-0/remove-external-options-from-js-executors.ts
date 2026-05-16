import { forEachExecutorOptions } from '@nx/devkit/internal';
import {
  formatFiles,
  readNxJson,
  readProjectConfiguration,
  updateNxJson,
  updateProjectConfiguration,
  type Tree,
} from '@nx/devkit';

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

  const cleanEntry = (entry: Record<string, any>) => {
    if (entry.options) {
      delete entry.options.external;
      delete entry.options.externalBuildTargets;
      if (!Object.keys(entry.options).length) {
        delete entry.options;
      }
    }
    Object.entries(entry.configurations ?? {}).forEach(([, config]: any) => {
      delete config.external;
      delete config.externalBuildTargets;
    });
  };

  if (Array.isArray(nxJson.targetDefaults)) {
    const remaining = [];
    for (const entry of nxJson.targetDefaults) {
      const matches =
        executors.includes(entry.executor) || executors.includes(entry.target);
      if (!matches) {
        remaining.push(entry);
        continue;
      }
      cleanEntry(entry as any);
      const meaningfulKeys = Object.keys(entry).filter(
        (k) =>
          k !== 'target' &&
          k !== 'executor' &&
          k !== 'projects' &&
          k !== 'plugin'
      );
      if (meaningfulKeys.length === 0) continue;
      remaining.push(entry);
    }
    if (remaining.length === 0) {
      delete nxJson.targetDefaults;
    } else {
      nxJson.targetDefaults = remaining;
    }
  } else {
    for (const [targetOrExecutor, targetConfig] of Object.entries(
      nxJson.targetDefaults
    )) {
      if (
        !executors.includes(targetOrExecutor) &&
        !executors.includes(targetConfig.executor)
      ) {
        continue;
      }

      cleanEntry(targetConfig as any);

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
  }

  updateNxJson(tree, nxJson);

  await formatFiles(tree);
}
