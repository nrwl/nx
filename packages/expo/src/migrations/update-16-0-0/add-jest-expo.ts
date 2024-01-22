import { getProjects, logger, stripIndents, Tree } from '@nx/devkit';
import {
  addPropertyToJestConfig,
  removePropertyFromJestConfig,
} from '@nx/jest';

/**
 * Change the preset in expo's jest config
 * - changes preset of jest.config to jest-expo
 */
export default async function update(tree: Tree) {
  const projects = getProjects(tree);

  for (const [name, config] of projects.entries()) {
    if (
      config.targets?.['start']?.executor === '@nrwl/expo:start' ||
      config.targets?.['start']?.executor === '@nx/expo:start'
    ) {
      const jestConfigPath = config.targets?.test?.options?.jestConfig;
      if (!jestConfigPath || !tree.exists(jestConfigPath)) return;
      try {
        removePropertyFromJestConfig(tree, jestConfigPath, 'preset');
        addPropertyToJestConfig(tree, jestConfigPath, 'preset', 'jest-expo');
      } catch {
        logger.error(
          stripIndents`Unable to update ${jestConfigPath} for project ${name}.`
        );
      }
    }
  }
}
