import { GeneratorCallback, Tree, ensurePackage } from '@nx/devkit';
import type { StorybookConfigurationOptions } from '../schema';
import { nxVersion } from '../../../utils/versions';

export async function generateStorybookConfiguration(
  tree: Tree,
  options: StorybookConfigurationOptions
): Promise<GeneratorCallback> {
  const { configurationGenerator } = ensurePackage('@nx/storybook', nxVersion);
  return await configurationGenerator(tree, {
    project: options.project,
    uiFramework: '@storybook/angular',
    configureCypress: options.configureCypress,
    linter: options.linter,
    cypressDirectory: options.cypressDirectory,
    tsConfiguration: options.tsConfiguration,
    interactionTests: options.interactionTests,
    configureStaticServe: options.configureStaticServe,
    skipFormat: true,
  });
}
