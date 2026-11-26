import { forEachExecutorOptions } from '@nx/devkit/internal';
import {
  formatFiles,
  readNxJson,
  readProjectConfiguration,
  type TargetConfiguration,
  type TargetDefaultArrayEntry,
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
        const targetConfiguration = projectConfiguration.targets?.[target];
        const config = configuration
          ? targetConfiguration?.configurations?.[configuration]
          : targetConfiguration?.options;
        if (!targetConfiguration || !config) {
          throw new Error(
            `Could not find target "${target}" in project "${project}".`
          );
        }
        delete config.external;
        delete config.externalBuildTargets;
        if (!configuration && !Object.keys(config).length) {
          delete targetConfiguration.options;
        }

        updateProjectConfiguration(tree, project, projectConfiguration);
      }
    );
  });

  // update options from nx.json target defaults
  const nxJson = readNxJson(tree);
  if (!nxJson?.targetDefaults) {
    return;
  }

  const cleanEntry = (entry: TargetConfiguration) => {
    if (entry.options) {
      delete entry.options.external;
      delete entry.options.externalBuildTargets;
      if (!Object.keys(entry.options).length) {
        delete entry.options;
      }
    }
    Object.values(entry.configurations ?? {}).forEach((config) => {
      delete config.external;
      delete config.externalBuildTargets;
    });
  };

  const targetDefaults = nxJson.targetDefaults;
  for (const key of Object.keys(targetDefaults)) {
    const value = targetDefaults[key];
    const entries: TargetDefaultArrayEntry[] = Array.isArray(value)
      ? value
      : [value];

    const isJsExecutor = (executor: string | undefined) =>
      executor !== undefined && executors.includes(executor);
    const usesExecutor = (entry: TargetDefaultArrayEntry) =>
      executors.includes(key) ||
      isJsExecutor(entry.executor) ||
      isJsExecutor(entry.filter?.executor);

    const kept = entries.filter((entry) => {
      if (usesExecutor(entry)) {
        cleanEntry(entry as TargetConfiguration);
      }
      // Drop entries left with nothing but their `filter`/`executor` locator.
      return Object.keys(entry).some((k) => k !== 'filter' && k !== 'executor');
    });

    if (kept.length === 0) {
      delete targetDefaults[key];
    } else if (kept.length === 1 && kept[0].filter === undefined) {
      // A lone unfiltered entry is stored as the plain object form (which
      // omits `filter`).
      const { filter: _filter, ...config } = kept[0];
      targetDefaults[key] = config;
    } else {
      targetDefaults[key] = kept;
    }
  }
  if (Object.keys(targetDefaults).length === 0) {
    delete nxJson.targetDefaults;
  }

  updateNxJson(tree, nxJson);

  await formatFiles(tree);
}
