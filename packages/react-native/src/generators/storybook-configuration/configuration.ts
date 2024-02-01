import { Tree, logger } from '@nx/devkit';
import { storybookConfigurationGenerator as reactStorybookConfigurationGenerator } from '@nx/react';
import { StorybookConfigureSchema } from './schema';

export function storybookConfigurationGenerator(
  tree: Tree,
  schema: StorybookConfigureSchema
) {
  return storybookConfigurationGeneratorInternal(tree, {
    addPlugin: false,
    ...schema,
  });
}

/**
 * This would be a direct pass through to @nx/react:storybook-configuration generator.
 * @TODO (@xiongemi): remove this generator for v19
 */
export async function storybookConfigurationGeneratorInternal(
  host: Tree,
  schema: StorybookConfigureSchema
) {
  logger.warn(
    `Please run 'nx run @nx/react:storybook-configuration ${schema.project}' instead.`
  );
  schema.addPlugin ??= process.env.NX_ADD_PLUGINS !== 'false';

  return reactStorybookConfigurationGenerator(host, schema);
}

export default storybookConfigurationGenerator;
