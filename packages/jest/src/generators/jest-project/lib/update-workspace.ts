import { JestProjectSchema } from '../schema';
import {
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
  joinPathFragments,
  normalizePath,
} from '@nrwl/devkit';

export function updateWorkspace(tree: Tree, options: JestProjectSchema) {
  const projectConfig = readProjectConfiguration(tree, options.project);
  projectConfig.targets.test = {
    executor: '@nrwl/jest:jest',
    outputs: [
      joinPathFragments(
        normalizePath('coverage'),
        normalizePath(projectConfig.root)
      ),
    ],
    options: {
      jestConfig: joinPathFragments(
        normalizePath(projectConfig.root),
        'jest.config.ts'
      ),
      passWithNoTests: true,
    },
  };

  const isUsingTSLint =
    projectConfig.targets.lint?.executor ===
    '@angular-devkit/build-angular:tslint';

  if (isUsingTSLint) {
    projectConfig.targets.lint.options.tsConfig = [
      ...(projectConfig.targets.lint.options.tsConfig || []),
      joinPathFragments(
        normalizePath(projectConfig.root),
        'tsconfig.spec.json'
      ),
    ];
  }
  updateProjectConfiguration(tree, options.project, projectConfig);
}
