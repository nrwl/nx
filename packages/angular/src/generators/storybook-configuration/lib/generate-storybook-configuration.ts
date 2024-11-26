import { GeneratorCallback, Tree, ensurePackage } from '@nx/devkit';
import type { StorybookConfigurationOptions } from '../schema';
import { nxVersion } from '../../../utils/versions';

export async function generateStorybookConfiguration(
  tree: Tree,
  options: StorybookConfigurationOptions
): Promise<GeneratorCallback> {
  const { configurationGenerator } = ensurePackage<
    typeof import('@nx/storybook')
  >('@nx/storybook', nxVersion);
  return await configurationGenerator(tree, {
    project: options.project,
    uiFramework: '@storybook/angular',
    linter: options.linter,
    tsConfiguration: options.tsConfiguration,
    interactionTests: options.interactionTests,
    configureStaticServe: options.configureStaticServe,
    skipFormat: true,
    addPlugin: false,
    addExplicitTargets: true,
  });
}
