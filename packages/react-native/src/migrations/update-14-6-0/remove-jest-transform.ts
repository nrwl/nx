import {
  formatFiles,
  logger,
  ProjectConfiguration,
  readProjectConfiguration,
  stripIndents,
  Tree,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { removePropertyFromJestConfig } from '@nx/jest';
import { JestExecutorOptions } from '@nx/jest/src/executors/jest/schema';
import { join } from 'path';

/**
 * Remove transfrom and testRunner in jest
 */
export default async function update(tree: Tree) {
  forEachExecutorOptions<JestExecutorOptions>(
    tree,
    '@nrwl/jest:jest',
    (options, projectName) => {
      if (options.jestConfig && tree.exists(options.jestConfig)) {
        const jestConfig = tree.read(options.jestConfig, 'utf-8');

        if (jestConfig.includes(`preset: 'react-native'`)) {
          const project = readProjectConfiguration(tree, projectName);
          removeTransform(tree, project);
          renameBabelJson(tree, project);
        }
      }
    }
  );

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

function renameBabelJson(host: Tree, project: ProjectConfiguration) {
  const babelrcPath = join(project.root, '.babelrc');
  const babelJsonPath = join(project.root, 'babel.config.json');
  if (!host.exists(babelrcPath)) {
    return;
  }
  try {
    const buffer = host.read(babelrcPath);
    if (!buffer) {
      return;
    }
    host.write(babelJsonPath, buffer);
    host.delete(babelrcPath);
  } catch {
    logger.error(
      stripIndents`Unable to rename from ${babelrcPath} to ${babelJsonPath} for project ${project.root}.`
    );
  }
}
