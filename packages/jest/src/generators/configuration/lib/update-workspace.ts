import {
  joinPathFragments,
  readProjectConfiguration,
  type Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { getInstalledJestMajorVersion } from '../../../utils/versions';
import type { NormalizedJestProjectSchema } from '../schema';

export function updateWorkspace(
  tree: Tree,
  options: NormalizedJestProjectSchema
) {
  const projectConfig = readProjectConfiguration(tree, options.project);
  if (!projectConfig.targets) {
    projectConfig.targets = {};
  }

  // Detect Jest 30+ to use .cts config files (CommonJS TypeScript)
  const jestMajorVersion = getInstalledJestMajorVersion(tree);
  const useCommonJsConfig = jestMajorVersion === null || jestMajorVersion >= 30;
  const jestConfigExt = options.js ? 'js' : useCommonJsConfig ? 'cts' : 'ts';

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
        projectConfig.root,
        `jest.config.${jestConfigExt}`
      ),
    },
  };

  if (options.setupFile === 'angular') {
    // We set the tsConfig in the target options so Angular migrations can discover it
    projectConfig.targets[options.targetName].options.tsConfig =
      joinPathFragments(projectConfig.root, 'tsconfig.spec.json');
  }

  updateProjectConfiguration(tree, options.project, projectConfig);
}
