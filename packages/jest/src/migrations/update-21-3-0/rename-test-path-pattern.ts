import {
  forEachExecutorOptions,
  updateTargetDefault,
} from '@nx/devkit/internal';
import {
  formatFiles,
  readNxJson,
  readProjectConfiguration,
  updateNxJson,
  updateProjectConfiguration,
  type Tree,
} from '@nx/devkit';
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

  // update options from nx.json target defaults. Migration order isn't
  // guaranteed, so a default may already be in the filtered array shape;
  // `updateTargetDefault` walks both the object and array value forms.
  const nxJson = readNxJson(tree);
  if (nxJson?.targetDefaults) {
    updateTargetDefault(nxJson, { executor: '@nx/jest:jest' }, (config) => {
      if (config.options) {
        renameTestPathPattern(config.options);
      }
      Object.values(config.configurations ?? {}).forEach((c) => {
        renameTestPathPattern(c);
      });
    });
    updateNxJson(tree, nxJson);
  }

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
