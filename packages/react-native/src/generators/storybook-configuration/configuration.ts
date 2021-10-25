import {
  convertNxGenerator,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { configurationGenerator } from '@nrwl/storybook';

import storiesGenerator from '../stories/stories';

import { StorybookConfigureSchema } from './schema';

async function generateStories(host: Tree, schema: StorybookConfigureSchema) {
  const libConfig = readProjectConfiguration(host, schema.name);
  const libRoot = libConfig.root;
  await storiesGenerator(host, {
    project: schema.name,
  });
}

export async function storybookConfigurationGenerator(
  host: Tree,
  schema: StorybookConfigureSchema
) {
  const installTask = await configurationGenerator(host, {
    name: schema.name,
    uiFramework: '@storybook/react-native',
    configureCypress: false,
    js: false,
    linter: schema.linter,
    standaloneConfig: schema.standaloneConfig,
  });

  if (schema.generateStories) {
    await generateStories(host, schema);
  }

  return installTask;
}

export default storybookConfigurationGenerator;
export const storybookConfigurationSchematic = convertNxGenerator(
  storybookConfigurationGenerator
);
