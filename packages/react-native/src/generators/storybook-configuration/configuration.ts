import {
  convertNxGenerator,
  GeneratorCallback,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { configurationGenerator } from '@nrwl/storybook';

import storiesGenerator from '../stories/stories';
import { createStorybookFiles } from './lib/create-storybook-files';
import { replaceAppImportWithStorybookToggle } from './lib/replace-app-import-with-storybook-toggle';

import { StorybookConfigureSchema } from './schema';

async function generateStories(host: Tree, schema: StorybookConfigureSchema) {
  await storiesGenerator(host, {
    project: schema.name,
  });
}

export async function storybookConfigurationGenerator(
  host: Tree,
  schema: StorybookConfigureSchema
): Promise<GeneratorCallback> {
  const installTask = await configurationGenerator(host, {
    name: schema.name,
    uiFramework: '@storybook/react-native',
    configureCypress: false,
    js: false,
    linter: schema.linter,
    standaloneConfig: schema.standaloneConfig,
    tsConfiguration: schema.tsConfiguration,
  });

  addStorybookTask(host, schema.name);
  createStorybookFiles(host, schema);
  replaceAppImportWithStorybookToggle(host, schema);

  if (schema.generateStories) {
    await generateStories(host, schema);
  }

  return installTask;
}

function addStorybookTask(host: Tree, projectName: string) {
  const projectConfig = readProjectConfiguration(host, projectName);
  projectConfig.targets['storybook'] = {
    executor: '@nrwl/react-native:storybook',
    options: {
      searchDir: projectConfig.root,
      outputFile: './.storybook/story-loader.js',
      pattern: '**/*.stories.@(js|jsx|ts|tsx|md)',
      silent: false,
    },
  };

  updateProjectConfiguration(host, projectName, projectConfig);
}

export default storybookConfigurationGenerator;
export const storybookConfigurationSchematic = convertNxGenerator(
  storybookConfigurationGenerator
);
