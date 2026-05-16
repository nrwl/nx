import { forEachExecutorOptions } from '@nx/devkit/internal';
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

const EXECUTOR_TO_MIGRATE = '@nx/jest:jest';
const ENTRY_META_KEYS = new Set(['target', 'executor', 'projects', 'plugin']);

export default async function (tree: Tree) {
  // update options from project configs
  forEachExecutorOptions<{ tsConfig?: string }>(
    tree,
    EXECUTOR_TO_MIGRATE,
    (options, project, target, configuration) => {
      if (options.tsConfig === undefined) {
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
    if (Array.isArray(nxJson.targetDefaults)) {
      const next: TargetDefaultEntry[] = [];
      for (const entry of nxJson.targetDefaults) {
        if (
          entry.target !== EXECUTOR_TO_MIGRATE &&
          entry.executor !== EXECUTOR_TO_MIGRATE
        ) {
          next.push(entry);
          continue;
        }

        if (entry.options) updateOptions(entry);
        Object.keys(entry.configurations ?? {}).forEach((config) => {
          updateConfiguration(entry, config);
        });

        if (!isEntryEmpty(entry)) {
          next.push(entry);
        }
      }
      if (next.length === 0) {
        delete nxJson.targetDefaults;
      } else {
        nxJson.targetDefaults = next;
      }
    } else {
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
    }

    updateNxJson(tree, nxJson);
  }

  await formatFiles(tree);
}

// An entry is "empty" once only filter/meta keys remain (target, executor,
// projects, plugin) — nothing else worth keeping around.
function isEntryEmpty(entry: TargetDefaultEntry): boolean {
  return Object.keys(entry).every((k) => ENTRY_META_KEYS.has(k));
}

function updateOptions(target: TargetConfiguration) {
  delete target.options.tsConfig;

  if (!Object.keys(target.options).length) {
    delete target.options;
  }
}

function updateConfiguration(
  target: TargetConfiguration,
  configuration: string
) {
  delete target.configurations[configuration].tsConfig;

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
