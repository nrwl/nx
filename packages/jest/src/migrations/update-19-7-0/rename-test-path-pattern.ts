import {
  formatFiles,
  readNxJson,
  readProjectConfiguration,
  updateNxJson,
  updateProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import type { JestExecutorOptions } from '../../executors/jest/schema';

// migration for https://github.com/jestjs/jest/commit/41133b526d2c17bc9758f90d6026b25301cf0552
export default async function (tree: Tree) {
  // update options from project configs
  forEachExecutorOptions<JestExecutorOptions>(
    tree,
    '@nx/jest:jest',
    (_, project, target, configuration) => {
      const projectConfiguration = readProjectConfiguration(tree, project);
      const config = configuration
        ? projectConfiguration.targets[target].configurations[configuration]
        : projectConfiguration.targets[target].options;

      renameTestPathPattern(config);

      updateProjectConfiguration(tree, project, projectConfiguration);
    }
  );

  // update options from nx.json target defaults
  const nxJson = readNxJson(tree);
  if (!nxJson.targetDefaults) {
    return;
  }

  for (const [targetOrExecutor, targetConfig] of Object.entries(
    nxJson.targetDefaults
  )) {
    if (
      targetOrExecutor !== '@nx/jest:jest' &&
      targetConfig.executor !== '@nx/jest:jest'
    ) {
      continue;
    }

    if (targetConfig.options) {
      renameTestPathPattern(targetConfig.options);
    }

    Object.values(targetConfig.configurations ?? {}).forEach((config) => {
      renameTestPathPattern(config);
    });
  }

  updateNxJson(tree, nxJson);

  await formatFiles(tree);
}

function renameTestPathPattern(config: {
  testPathPattern?: string;
  testPathPatterns?: string;
}): void {
  if (!config.testPathPattern) {
    return;
  }

  config.testPathPatterns = config.testPathPattern;
  delete config.testPathPattern;
}
