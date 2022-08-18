import {
  joinPathFragments,
  ProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { JestExecutorOptions } from '@nrwl/jest/src/executors/jest/schema';
import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';
import { tsquery } from '@phenomnomnominal/tsquery';
import { StringLiteral } from 'typescript';

export function addBabelJestPresetTransformerOption(tree: Tree) {
  forEachExecutorOptions<JestExecutorOptions>(
    tree,
    '@nrwl/jest:jest',
    (options, project, target, configuration) => {
      if (
        options.jestConfig &&
        tree.exists(options.jestConfig) &&
        isReactProject(tree, readProjectConfiguration(tree, project))
      ) {
        const oldConfig = tree.read(options.jestConfig, 'utf-8');
        const updatedConfig = tsquery.replace(
          oldConfig,
          'PropertyAssignment > StringLiteral[value="babel-jest"]',
          (node: StringLiteral) => {
            return `['babel-jest', { presets: ['@nrwl/react/babel'] }]`;
          }
        );
        tree.write(options.jestConfig, updatedConfig);
      }
    }
  );
}

function isReactProject(tree: Tree, projectConfig: ProjectConfiguration) {
  const knownInvalidExecutors = [
    '@nrwl/next:build',
    '@nrwl/angular',
    '@angular-devkit/build-angular:browser',
    '@nrwl/js:tsc',
    '@nrwl/js:swc',
    '@nrwl/workspace:run-commands',
    'nx:run-commands',
    '@nrwl/node:webpack',
  ];
  if (
    knownInvalidExecutors.includes(projectConfig?.targets?.build?.executor) ||
    tree.exists(joinPathFragments(projectConfig.root, 'next.config.js'))
  ) {
    return false;
  }
  return true;
}

export default addBabelJestPresetTransformerOption;
