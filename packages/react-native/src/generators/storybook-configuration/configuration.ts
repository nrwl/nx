import { Tree, logger } from '@nx/devkit';
import { storybookConfigurationGenerator as reactStorybookConfigurationGenerator } from '@nx/react';
import { StorybookConfigureSchema } from './schema';

/**
 * This would be a direct pass through to @nx/react:storybook-configuration generator.
 * @TODO (@xiongemi): remove this generator for v19
 */
export async function storybookConfigurationGenerator(
  host: Tree,
  schema: StorybookConfigureSchema
) {
  logger.warn(
    `Please run 'nx run @nx/react:storybook-configuration ${schema.project}' instead.`
  );
  return reactStorybookConfigurationGenerator(host, schema);
}

export default storybookConfigurationGenerator;
