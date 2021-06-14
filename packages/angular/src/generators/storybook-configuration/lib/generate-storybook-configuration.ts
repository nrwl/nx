import type { Tree } from '@nrwl/devkit';
import { configurationGenerator } from '@nrwl/storybook';
import type { StorybookConfigurationOptions } from '../schema';

export async function generateStorybookConfiguration(
  tree: Tree,
  options: StorybookConfigurationOptions
): Promise<void> {
  await configurationGenerator(tree, {
    name: options.name,
    uiFramework: '@storybook/angular',
    configureCypress: options.configureCypress,
    linter: options.linter,
    cypressDirectory: options.cypressDirectory,
  });
}
