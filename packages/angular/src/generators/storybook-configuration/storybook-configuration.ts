import type { GeneratorCallback, Tree } from '@nrwl/devkit';
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
  const installTask = await generateStorybookConfiguration(tree, options);

  if (options.generateStories) {
    generateStories(tree, options);
  }

  return installTask;
}

export default storybookConfigurationGenerator;
