import { getE2eProjectName } from '@nrwl/cypress/src/utils/project-name';
import type { Tree } from '@nrwl/devkit';
import { readProjectConfiguration } from '@nrwl/devkit';
import { angularStoriesGenerator } from '../../stories/stories';
import type { StorybookConfigurationOptions } from '../schema';

export function generateStories(
  tree: Tree,
  options: StorybookConfigurationOptions
) {
  const project = readProjectConfiguration(tree, options.name);
  const e2eProjectName = getE2eProjectName(
    options.name,
    project.root,
    options.cypressDirectory
  );

  angularStoriesGenerator(tree, {
    name: options.name,
    generateCypressSpecs:
      options.configureCypress && options.generateCypressSpecs,
    cypressProject: e2eProjectName,
  });
}
