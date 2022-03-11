import { StorybookConfigureSchema } from './schema';
import storiesGenerator from '../stories/stories';
import {
  convertNxGenerator,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { configurationGenerator } from '@nrwl/storybook';
import { getE2eProjectName } from '@nrwl/cypress/src/utils/project-name';

async function generateStories(host: Tree, schema: StorybookConfigureSchema) {
  const libConfig = readProjectConfiguration(host, schema.name);
  const libRoot = libConfig.root;
  const cypressProject = getE2eProjectName(
    schema.name,
    libRoot,
    schema.cypressDirectory
  );
  await storiesGenerator(host, {
    project: schema.name,
    generateCypressSpecs:
      schema.configureCypress && schema.generateCypressSpecs,
    js: schema.js,
    cypressProject,
    rootPath: schema.rootPath,
  });
}

export async function storybookConfigurationGenerator(
  host: Tree,
  schema: StorybookConfigureSchema
) {
  const installTask = await configurationGenerator(host, {
    name: schema.name,
    uiFramework: '@storybook/react',
    configureCypress: schema.configureCypress,
    js: schema.js,
    linter: schema.linter,
    cypressDirectory: schema.cypressDirectory,
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
