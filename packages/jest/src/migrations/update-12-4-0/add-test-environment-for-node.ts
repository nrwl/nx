import {
  formatFiles,
  logger,
  ProjectConfiguration,
  readProjectConfiguration,
  stripIndents,
  Tree,
} from '@nrwl/devkit';
import { join } from 'path';

import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';
import { JestExecutorOptions } from '../../executors/jest/schema';
import { addPropertyToJestConfig } from '../../utils/config/update-config';

function updateJestConfig(tree: Tree) {
  forEachExecutorOptions<JestExecutorOptions>(
    tree,
    '@nrwl/jest:jest',
    (options, project) => {
      if (!options.jestConfig) {
        return;
      }

      const jestConfigPath = options.jestConfig;
      const jestConfig = require(join(tree.root, jestConfigPath));
      const projectConfig = readProjectConfiguration(tree, project);
      const testEnvironment = jestConfig.testEnvironment;

      if (testEnvironment || !checkIfNodeProject(projectConfig)) {
        return;
      }

      try {
        addPropertyToJestConfig(
          tree,
          jestConfigPath,
          'testEnvironment',
          'node'
        );
      } catch {
        logger.error(
          stripIndents`Unable to update jest.config.js for project ${project}.`
        );
      }
    }
  );
}

export default async function update(tree: Tree) {
  updateJestConfig(tree);
  await formatFiles(tree);
}

function checkIfNodeProject(config: ProjectConfiguration) {
  return Object.entries(config.targets).some(([targetName, targetConfig]) =>
    targetConfig.executor?.includes?.('node')
  );
}
