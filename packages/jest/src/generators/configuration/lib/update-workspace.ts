import { NormalizedJestProjectSchema } from '../schema';
import {
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
  joinPathFragments,
  normalizePath,
} from '@nx/devkit';

export function updateWorkspace(
  tree: Tree,
  options: NormalizedJestProjectSchema
) {
  const projectConfig = readProjectConfiguration(tree, options.project);
  if (!projectConfig.targets) {
    projectConfig.targets = {};
  }

  projectConfig.targets[options.targetName] = {
    executor: '@nx/jest:jest',
    outputs: [
      options.isTsSolutionSetup
        ? '{projectRoot}/test-output/jest/coverage'
        : joinPathFragments(
            '{workspaceRoot}',
            'coverage',
            options.rootProject ? '{projectName}' : '{projectRoot}'
          ),
    ],
    options: {
      jestConfig: joinPathFragments(
        normalizePath(projectConfig.root),
        `jest.config.${options.js ? 'js' : 'ts'}`
      ),
    },
  };

  updateProjectConfiguration(tree, options.project, projectConfig);
}
