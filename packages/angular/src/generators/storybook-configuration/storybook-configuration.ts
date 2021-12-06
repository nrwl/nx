import type { GeneratorCallback, Tree } from '@nrwl/devkit';
import { addDependenciesToPackageJson } from '@nrwl/devkit';
import { storybookVersion } from '../../utils/versions';
import { assertCompatibleStorybookVersion } from './lib/assert-compatible-storybook-version';
import { generateStories } from './lib/generate-stories';
import { generateStorybookConfiguration } from './lib/generate-storybook-configuration';
import { validateOptions } from './lib/validate-options';
import type { StorybookConfigurationOptions } from './schema';

export async function storybookConfigurationGenerator(
  tree: Tree,
  options: StorybookConfigurationOptions
): Promise<GeneratorCallback> {
  assertCompatibleStorybookVersion();
  validateOptions(options);

  // TODO(coly010/juristr): remove when @nrwl/storybook has been updated
  const angularStorybookInstallTask = addDependenciesToPackageJson(
    tree,
    {},
    {
      '@storybook/angular': storybookVersion,
      '@storybook/manager-webpack5': storybookVersion,
      '@storybook/builder-webpack5': storybookVersion,
      '@storybook/addon-essentials': storybookVersion,
    }
  );
  const storybookGeneratorInstallTask = await generateStorybookConfiguration(
    tree,
    options
  );

  if (options.generateStories) {
    generateStories(tree, options);
  }

  return () => {
    angularStorybookInstallTask();
    storybookGeneratorInstallTask();
  };
}

export default storybookConfigurationGenerator;
