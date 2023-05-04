import { GeneratorCallback, Tree, ensurePackage } from '@nx/devkit';
import type { StorybookConfigurationOptions } from '../schema';
import { nxVersion } from '../../../utils/versions';

export async function generateStorybookConfiguration(
  tree: Tree,
  options: StorybookConfigurationOptions
): Promise<GeneratorCallback> {
  const { configurationGenerator } = ensurePackage('@nx/storybook', nxVersion);
  return await configurationGenerator(tree, {
    name: options.name,
    uiFramework: '@storybook/angular',
    configureCypress: options.configureCypress,
    linter: options.linter,
    cypressDirectory: options.cypressDirectory,
    tsConfiguration: options.tsConfiguration,
    configureTestRunner: options.configureTestRunner,
    configureStaticServe: options.configureStaticServe,
    skipFormat: true,
  });
}
