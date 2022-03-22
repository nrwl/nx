import { formatFiles, logger, stripIndents, Tree } from '@nrwl/devkit';
import { join } from 'path';

import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';
import { JestExecutorOptions } from '../../executors/jest/schema';
import {
  addPropertyToJestConfig,
  removePropertyFromJestConfig,
} from '../../utils/config/update-config';

function updateJestConfig(tree: Tree) {
  forEachExecutorOptions<JestExecutorOptions>(
    tree,
    '@nrwl/jest:jest',
    (options, project) => {
      if (!options.jestConfig) {
        return;
      }

      const jestConfigPath = options.jestConfig;
      const config = require(join(tree.root, jestConfigPath));
      const tsJestConfig = config.globals?.['ts-jest'];
      if (!(tsJestConfig && tsJestConfig.tsConfig)) {
        return;
      }

      try {
        removePropertyFromJestConfig(
          tree,
          jestConfigPath,
          'globals.ts-jest.tsConfig'
        );
        addPropertyToJestConfig(
          tree,
          jestConfigPath,
          'globals.ts-jest.tsconfig',
          tsJestConfig.tsConfig
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
