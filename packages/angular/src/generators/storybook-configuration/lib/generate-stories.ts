import type { Tree } from '@nx/devkit';
import { readProjectConfiguration } from '@nx/devkit';
import { angularStoriesGenerator } from '../../stories/stories';
import type { StorybookConfigurationOptions } from '../schema';

export async function generateStories(
  tree: Tree,
  options: StorybookConfigurationOptions
) {
  const project = readProjectConfiguration(tree, options.project);

  await angularStoriesGenerator(tree, {
    name: options.project,
    ignorePaths: options.ignorePaths,
    interactionTests: options.interactionTests,
    skipFormat: true,
  });
}
