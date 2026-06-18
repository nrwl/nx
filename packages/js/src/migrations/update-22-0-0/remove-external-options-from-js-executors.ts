import {
  denormalizeTargetDefaults,
  forEachExecutorOptions,
  normalizeTargetDefaults,
} from '@nx/devkit/internal';
import {
  formatFiles,
  readNxJson,
  readProjectConfiguration,
  type TargetDefaultEntry,
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

  // Operate on the flat logical view so both the object and array value forms
  // are handled uniformly, then collapse back to the map shape.
  const entries = normalizeTargetDefaults(nxJson.targetDefaults);
  const remaining: TargetDefaultEntry[] = [];
  for (const entry of entries) {
    const matches =
      executors.includes(entry.executor) || executors.includes(entry.target);
    if (!matches) {
      remaining.push(entry);
      continue;
    }
    cleanEntry(entry as any);
    const meaningfulKeys = Object.keys(entry).filter(
      (k) =>
        k !== 'target' && k !== 'executor' && k !== 'projects' && k !== 'plugin'
    );
    if (meaningfulKeys.length === 0) continue;
    remaining.push(entry);
  }
  if (remaining.length === 0) {
    delete nxJson.targetDefaults;
  } else {
    nxJson.targetDefaults = denormalizeTargetDefaults(remaining);
  }

  updateNxJson(tree, nxJson);

  await formatFiles(tree);
}
