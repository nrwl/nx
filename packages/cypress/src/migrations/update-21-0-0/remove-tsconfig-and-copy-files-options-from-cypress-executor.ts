import { forEachExecutorOptions } from '@nx/devkit/internal';
import {
  formatFiles,
  readNxJson,
  readProjectConfiguration,
  type TargetConfiguration,
  type TargetDefaultArrayEntry,
  type Tree,
  updateNxJson,
  updateProjectConfiguration,
} from '@nx/devkit';
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
    const targetDefaults = nxJson.targetDefaults;
    for (const key of Object.keys(targetDefaults)) {
      const value = targetDefaults[key];
      const entries: TargetDefaultArrayEntry[] = Array.isArray(value)
        ? value
        : [value];

      const usesExecutor = (entry: TargetDefaultArrayEntry) =>
        key === EXECUTOR_TO_MIGRATE ||
        entry.executor === EXECUTOR_TO_MIGRATE ||
        entry.filter?.executor === EXECUTOR_TO_MIGRATE;

      const kept = entries.filter((entry) => {
        if (usesExecutor(entry)) {
          if (entry.options) {
            updateOptions(entry as TargetConfiguration);
          }
          Object.keys(entry.configurations ?? {}).forEach((config) => {
            updateConfiguration(entry as TargetConfiguration, config);
          });
        }
        // Drop entries left with nothing but their `filter`/`executor` locator.
        return Object.keys(entry).some(
          (k) => k !== 'filter' && k !== 'executor'
        );
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
