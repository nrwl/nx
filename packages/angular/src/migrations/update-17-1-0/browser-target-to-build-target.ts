import {
  formatFiles,
  readNxJson,
  readProjectConfiguration,
  updateNxJson,
  updateProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';

export const executors = [
  '@angular-devkit/build-angular:dev-server',
  '@angular-devkit/build-angular:extract-i18n',
  '@nx/angular:module-federation-dev-server',
  '@nx/angular:webpack-dev-server',
];

export default async function (tree: Tree) {
  // update options from project configs
  executors.forEach((executor) => {
    forEachExecutorOptions<{
      browserTarget?: string;
      buildTarget?: string;
    }>(tree, executor, (_, project, target, configuration) => {
      const projectConfiguration = readProjectConfiguration(tree, project);
      const config = configuration
        ? projectConfiguration.targets[target].configurations[configuration]
        : projectConfiguration.targets[target].options;

      updateConfig(config);

      updateProjectConfiguration(tree, project, projectConfiguration);
    });
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
      updateConfig(targetConfig.options);
    }

    Object.values(targetConfig.configurations ?? {}).forEach((config) => {
      updateConfig(config);
    });
  }

  updateNxJson(tree, nxJson);

  await formatFiles(tree);
}

function updateConfig(config: {
  browserTarget?: string;
  buildTarget?: string;
}): void {
  if (config && config.browserTarget) {
    config.buildTarget ??= config.browserTarget;
    delete config.browserTarget;
  }
}
