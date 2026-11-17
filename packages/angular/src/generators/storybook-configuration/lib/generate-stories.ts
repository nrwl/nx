import type { Tree } from '@nx/devkit';
import { angularStoriesGenerator } from '../../stories/stories';
import type { StorybookConfigurationOptions } from '../schema';

export async function generateStories(
  tree: Tree,
  options: StorybookConfigurationOptions
) {
  await angularStoriesGenerator(tree, {
    name: options.project,
    ignorePaths: options.ignorePaths,
    interactionTests: options.interactionTests,
    skipFormat: true,
  });
}
