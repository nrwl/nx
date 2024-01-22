import { getE2eProjectName } from '@nx/cypress/src/utils/project-name';
import type { Tree } from '@nx/devkit';
import { readProjectConfiguration } from '@nx/devkit';
import { angularStoriesGenerator } from '../../stories/stories';
import type { StorybookConfigurationOptions } from '../schema';

export async function generateStories(
  tree: Tree,
  options: StorybookConfigurationOptions
) {
  const project = readProjectConfiguration(tree, options.project);
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
