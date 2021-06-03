import type { Tree } from '@nrwl/devkit';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';
import type { StorybookConfigurationOptions } from '../schema';

export async function generateStorybookConfiguration(
  tree: Tree,
  options: StorybookConfigurationOptions
): Promise<void> {
  const storybookConfigGenerator = wrapAngularDevkitSchematic(
    '@nrwl/storybook',
    'configuration'
  );
  await storybookConfigGenerator(tree, {
    name: options.name,
    uiFramework: '@storybook/angular',
    configureCypress: options.configureCypress,
    linter: options.linter,
    cypressDirectory: options.cypressDirectory,
  });
}
