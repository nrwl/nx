import {
  formatFiles,
  logger,
  ProjectConfiguration,
  readProjectConfiguration,
  stripIndents,
  Tree,
} from '@nrwl/devkit';
import { removePropertyFromJestConfig } from '@nrwl/jest';
import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';

/**
 * Remove transfrom and testRunner in jest
 */
export default async function update(tree: Tree) {
  forEachExecutorOptions(tree, '@nrwl/react-native:start', (_, projectName) => {
    const project = readProjectConfiguration(tree, projectName);
    removeTransform(tree, project);
  });

  await formatFiles(tree);
}

function removeTransform(host: Tree, project: ProjectConfiguration) {
  const jestConfigPath = project.targets?.test?.options?.jestConfig;
  if (!jestConfigPath || !host.exists(jestConfigPath)) return;
  try {
    removePropertyFromJestConfig(host, jestConfigPath, 'transform');
    removePropertyFromJestConfig(host, jestConfigPath, 'testRunner');
  } catch {
    logger.error(
      stripIndents`Unable to update ${jestConfigPath} for project ${project.root}.`
    );
  }
}
