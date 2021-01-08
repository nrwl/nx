import { join, normalize } from '@angular-devkit/core';
import { JestProjectSchema } from '../schema';
import {
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';

export function updateWorkspace(tree: Tree, options: JestProjectSchema) {
  const projectConfig = readProjectConfiguration(tree, options.project);
  projectConfig.targets.test = {
    executor: '@nrwl/jest:jest',
    outputs: [join(normalize('coverage'), normalize(projectConfig.root))],
    options: {
      jestConfig: join(normalize(projectConfig.root), 'jest.config.js'),
      passWithNoTests: true,
    },
  };

  const isUsingTSLint =
    projectConfig.targets.lint?.executor ===
    '@angular-devkit/build-angular:tslint';

  if (isUsingTSLint) {
    projectConfig.targets.lint.options.tsConfig = [
      ...projectConfig.targets.lint.options.tsConfig,
      join(normalize(projectConfig.root), 'tsconfig.spec.json'),
    ];
  }
  updateProjectConfiguration(tree, options.project, projectConfig);
}
