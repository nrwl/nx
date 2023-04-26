import { formatFiles, GeneratorCallback, Tree } from '@nx/devkit';
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

  const storybookGeneratorInstallTask = await generateStorybookConfiguration(
    tree,
    options
  );

  if (options.generateStories) {
    await generateStories(tree, { ...options, skipFormat: true });
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return () => {
    storybookGeneratorInstallTask();
  };
}

export default storybookConfigurationGenerator;
