import { StorybookConfigureSchema } from './schema';
import storiesGenerator from '../stories/stories';
import {
  convertNxGenerator,
  ensurePackage,
  formatFiles,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { nxVersion } from '../../utils/versions';

async function generateStories(host: Tree, schema: StorybookConfigureSchema) {
  ensurePackage('@nx/cypress', nxVersion);
  const { getE2eProjectName } = await import(
    '@nx/cypress/src/utils/project-name'
  );
  const projectConfig = readProjectConfiguration(host, schema.name);
  const cypressProject = getE2eProjectName(
    schema.name,
    projectConfig.root,
    schema.cypressDirectory
  );
  await storiesGenerator(host, {
    project: schema.name,
    generateCypressSpecs:
      schema.configureCypress && schema.generateCypressSpecs,
    js: schema.js,
    cypressProject,
    ignorePaths: schema.ignorePaths,
    skipFormat: true,
  });
}

export async function storybookConfigurationGenerator(
  host: Tree,
  schema: StorybookConfigureSchema
) {
  const { configurationGenerator } = ensurePackage<
    typeof import('@nx/storybook')
  >('@nx/storybook', nxVersion);

  let bundler = 'vite';
  const projectConfig = readProjectConfiguration(host, schema.name);

  if (
    projectConfig.projectType === 'application' &&
    (projectConfig.targets['build']?.executor === '@nx/webpack:webpack' ||
      projectConfig.targets['build']?.executor === '@nrwl/webpack:webpack')
  ) {
    bundler = 'webpack';
  }

  const installTask = await configurationGenerator(host, {
    name: schema.name,
    configureCypress: schema.configureCypress,
    js: schema.js,
    linter: schema.linter,
    cypressDirectory: schema.cypressDirectory,
    tsConfiguration: schema.tsConfiguration,
    configureTestRunner: schema.configureTestRunner,
    configureStaticServe: schema.configureStaticServe,
    uiFramework:
      bundler === 'vite'
        ? '@storybook/react-vite'
        : '@storybook/react-webpack5',
    skipFormat: true,
  });

  if (schema.generateStories) {
    await generateStories(host, schema);
  }

  await formatFiles(host);

  return installTask;
}

export default storybookConfigurationGenerator;
export const storybookConfigurationSchematic = convertNxGenerator(
  storybookConfigurationGenerator
);
