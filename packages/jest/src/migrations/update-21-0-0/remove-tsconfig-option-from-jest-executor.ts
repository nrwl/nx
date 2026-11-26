import {
  forEachExecutorOptions,
  updateTargetDefault,
} from '@nx/devkit/internal';
import {
  formatFiles,
  readNxJson,
  readProjectConfiguration,
  type TargetConfiguration,
  type Tree,
  updateNxJson,
  updateProjectConfiguration,
} from '@nx/devkit';

const EXECUTOR_TO_MIGRATE = '@nx/jest:jest';

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
      const targetConfiguration = projectConfiguration.targets?.[target];
      if (!targetConfiguration) {
        throw new Error(
          `Could not find target "${target}" in project "${project}".`
        );
      }
      if (configuration) {
        updateConfiguration(targetConfiguration, configuration);
      } else {
        updateOptions(targetConfiguration);
      }

      updateProjectConfiguration(tree, project, projectConfiguration);
    }
  );

  // update options from nx.json target defaults. `updateTargetDefault` walks
  // both the object and filtered array value forms, drops entries left with
  // nothing but their executor locator, and collapses lone unfiltered ones
  // back to the object form.
  const nxJson = readNxJson(tree);
  if (nxJson?.targetDefaults) {
    updateTargetDefault(nxJson, { executor: EXECUTOR_TO_MIGRATE }, (config) => {
      if (config.options) updateOptions(config as TargetConfiguration);
      Object.keys(config.configurations ?? {}).forEach((configuration) => {
        updateConfiguration(config as TargetConfiguration, configuration);
      });
      // Drop the entry once nothing but its executor locator remains.
      const keys = Object.keys(config);
      if (keys.length === 0 || (keys.length === 1 && keys[0] === 'executor')) {
        return null;
      }
    });
    updateNxJson(tree, nxJson);
  }

  await formatFiles(tree);
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
  const configurations = target.configurations;
  if (!configurations) {
    throw new Error(`Could not find configuration "${configuration}".`);
  }
  delete configurations[configuration].tsConfig;

  if (
    !Object.keys(configurations[configuration]).length &&
    (!target.defaultConfiguration ||
      target.defaultConfiguration !== configuration)
  ) {
    delete configurations[configuration];
  }
  if (!Object.keys(configurations).length) {
    delete target.configurations;
  }
}
