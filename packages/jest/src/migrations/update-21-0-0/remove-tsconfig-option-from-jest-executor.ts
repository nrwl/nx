import {
  denormalizeTargetDefaults,
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
    // Operate on the flat logical view so both the object and array value
    // forms are handled uniformly, then collapse back to the map shape.
    const entries = normalizeTargetDefaults(nxJson.targetDefaults);
    const remaining: TargetDefaultEntry[] = [];
    for (const entry of entries) {
      if (
        entry.target !== EXECUTOR_TO_MIGRATE &&
        entry.executor !== EXECUTOR_TO_MIGRATE
      ) {
        remaining.push(entry);
        continue;
      }

      if (entry.options) updateOptions(entry as TargetConfiguration);
      Object.keys(entry.configurations ?? {}).forEach((config) => {
        updateConfiguration(entry as TargetConfiguration, config);
      });

      if (!isEntryEmpty(entry)) {
        remaining.push(entry);
      }
    }
    if (remaining.length === 0) {
      delete nxJson.targetDefaults;
    } else {
      nxJson.targetDefaults = denormalizeTargetDefaults(remaining);
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
