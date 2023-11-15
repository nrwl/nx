import { StorybookConfigureSchema } from './schema';
import storiesGenerator from '../stories/stories';
import { ensurePackage, formatFiles, Tree } from '@nx/devkit';
import { nxVersion } from '../../utils/versions';

async function generateStories(host: Tree, schema: StorybookConfigureSchema) {
  await storiesGenerator(host, {
    project: schema.project,
    js: schema.js,
    ignorePaths: schema.ignorePaths,
    skipFormat: true,
    interactionTests: schema.interactionTests ?? true,
  });
}

export async function storybookConfigurationGenerator(
  host: Tree,
  schema: StorybookConfigureSchema
) {
  const { configurationGenerator } = ensurePackage<
    typeof import('@nx/storybook')
  >('@nx/storybook', nxVersion);

  const installTask = await configurationGenerator(host, {
    project: schema.project,
    js: schema.js,
    linter: schema.linter,
    tsConfiguration: schema.tsConfiguration ?? true, // default is true
    interactionTests: schema.interactionTests ?? true, // default is true
    configureStaticServe: schema.configureStaticServe,
    uiFramework: '@storybook/vue3-vite',
    skipFormat: true,
  });

  if (schema.generateStories) {
    await generateStories(host, schema);
  }

  await formatFiles(host);

  return installTask;
}

export default storybookConfigurationGenerator;
