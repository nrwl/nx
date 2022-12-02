import { GeneratorCallback, Tree, ensurePackage } from '@nrwl/devkit';
import type { StorybookConfigurationOptions } from '../schema';
import { nxVersion } from '../../../utils/versions';

export async function generateStorybookConfiguration(
  tree: Tree,
  options: StorybookConfigurationOptions
): Promise<GeneratorCallback> {
  await ensurePackage(tree, '@nrwl/storybook', nxVersion);
  const { configurationGenerator } = await import('@nrwl/storybook');
  return await configurationGenerator(tree, {
    name: options.name,
    uiFramework: '@storybook/angular',
    configureCypress: options.configureCypress,
    linter: options.linter,
    cypressDirectory: options.cypressDirectory,
    tsConfiguration: options.tsConfiguration,
  });
}
