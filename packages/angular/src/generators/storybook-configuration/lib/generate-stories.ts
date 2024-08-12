import type { Tree } from '@nx/devkit';
import { ensurePackage, readProjectConfiguration } from '@nx/devkit';
import { nxVersion } from '../../../utils/versions';
import { angularStoriesGenerator } from '../../stories/stories';
import type { StorybookConfigurationOptions } from '../schema';

export async function generateStories(
  tree: Tree,
  options: StorybookConfigurationOptions
) {
  const project = readProjectConfiguration(tree, options.project);
  ensurePackage('@nx/cypress', nxVersion);
  const { getE2eProjectName } = <
    typeof import('@nx/cypress/src/utils/project-name')
  >require('@nx/cypress/src/utils/project-name');
  const e2eProjectName = getE2eProjectName(
    options.project,
    project.root,
    options.cypressDirectory
  );

  await angularStoriesGenerator(tree, {
    name: options.project,
    generateCypressSpecs:
      options.configureCypress && options.generateCypressSpecs,
    cypressProject: e2eProjectName,
    ignorePaths: options.ignorePaths,
    interactionTests: options.interactionTests,
    skipFormat: true,
  });
}
