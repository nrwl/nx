import {
  downgradeTargetDefaults,
  forEachExecutorOptions,
  normalizeTargetDefaults,
} from '@nx/devkit/internal';
import {
  formatFiles,
  readNxJson,
  readProjectConfiguration,
  type TargetConfiguration,
  type TargetDefaultEntry,
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
    const originalShape = nxJson.targetDefaults;
    const entries = normalizeTargetDefaults(originalShape);
    const remaining: TargetDefaultEntry[] = [];
    for (const entry of entries) {
      const matches =
        entry.executor === EXECUTOR_TO_MIGRATE ||
        entry.target === EXECUTOR_TO_MIGRATE;
      if (!matches) {
        remaining.push(entry);
        continue;
      }
      if (entry.options) {
        updateOptions(entry as TargetConfiguration);
      }
      Object.keys(entry.configurations ?? {}).forEach((config) => {
        updateConfiguration(entry as TargetConfiguration, config);
      });

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
      nxJson.targetDefaults = Array.isArray(originalShape)
        ? remaining
        : downgradeTargetDefaults(remaining);
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
