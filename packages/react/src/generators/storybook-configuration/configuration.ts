import { StorybookConfigureSchema } from './schema';
import storiesGenerator from '../stories/stories';
import {
  convertNxGenerator,
  ensurePackage,
  logger,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { nxVersion } from '../../utils/versions';

async function generateStories(host: Tree, schema: StorybookConfigureSchema) {
  ensurePackage('@nrwl/cypress', nxVersion);
  const { getE2eProjectName } = await import(
    '@nrwl/cypress/src/utils/project-name'
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
  });
}

export async function storybookConfigurationGenerator(
  host: Tree,
  schema: StorybookConfigureSchema
) {
  const { configurationGenerator } = ensurePackage(
    '@nrwl/storybook',
    nxVersion
  );

  let bundler = schema.bundler ?? 'webpack';
  const projectConfig = readProjectConfiguration(host, schema.name);

  if (
    projectConfig.projectType === 'application' &&
    projectConfig.targets['build']?.executor === '@nrwl/vite:build'
  ) {
    bundler = 'vite';
    if (schema.bundler !== 'vite') {
      logger.info(
        `The project ${schema.name} is set up to use Vite. So
      Storybook will be configured to use Vite as well.`
      );
    }
  }

  const installTask = await configurationGenerator(host, {
    name: schema.name,
    uiFramework: '@storybook/react',
    configureCypress: schema.configureCypress,
    js: schema.js,
    linter: schema.linter,
    cypressDirectory: schema.cypressDirectory,
    standaloneConfig: schema.standaloneConfig,
    tsConfiguration: schema.tsConfiguration,
    configureTestRunner: schema.configureTestRunner,
    configureStaticServe: schema.configureStaticServe,
    bundler,
    storybook7Configuration: schema.storybook7Configuration,
    storybook7UiFramework:
      bundler === 'vite'
        ? '@storybook/react-vite'
        : '@storybook/react-webpack5',
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
