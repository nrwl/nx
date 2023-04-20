import {
  joinPathFragments,
  ProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import type { JestExecutorOptions } from '@nx/jest/src/executors/jest/schema';
import { tsquery } from '@phenomnomnominal/tsquery';
import { StringLiteral } from 'typescript';

export function addBabelJestPresetTransformerOption(tree: Tree) {
  forEachExecutorOptions<JestExecutorOptions>(
    tree,
    '@nx/jest:jest',
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
            return `['babel-jest', { presets: ['@nx/react/babel'] }]`;
          }
        );
        tree.write(options.jestConfig, updatedConfig);
      }
    }
  );
}

function isReactProject(tree: Tree, projectConfig: ProjectConfiguration) {
  const knownInvalidExecutors = [
    '@nx/next:build',
    '@nx/angular',
    '@angular-devkit/build-angular:browser',
    '@nx/js:tsc',
    '@nx/js:swc',
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
