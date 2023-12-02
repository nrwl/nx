import { StorybookConfigureSchema } from './schema';
import storiesGenerator from '../stories/stories';
import {
  ensurePackage,
  formatFiles,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { nxVersion } from '../../utils/versions';

async function generateStories(host: Tree, schema: StorybookConfigureSchema) {
  // TODO(katerina): Nx 18 -> remove Cypress
  ensurePackage('@nx/cypress', nxVersion);
  const { getE2eProjectName } = await import(
    '@nx/cypress/src/utils/project-name'
  );
  const projectConfig = readProjectConfiguration(host, schema.project);
  const cypressProject = getE2eProjectName(
    schema.project,
    projectConfig.root,
    schema.cypressDirectory
  );
  await storiesGenerator(host, {
    project: schema.project,
    generateCypressSpecs:
      schema.configureCypress && schema.generateCypressSpecs,
    js: schema.js,
    cypressProject,
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

  let uiFramework = '@storybook/react-vite';
  const projectConfig = readProjectConfiguration(host, schema.project);

  if (
    projectConfig.targets['build']?.executor === '@nx/webpack:webpack' ||
    projectConfig.targets['build']?.executor === '@nrwl/webpack:webpack' ||
    projectConfig.targets['build']?.executor === '@nx/rollup:rollup' ||
    projectConfig.targets['build']?.executor === '@nrwl/rollup:rollup'
  ) {
    uiFramework = '@storybook/react-webpack5';
  }

  const installTask = await configurationGenerator(host, {
    project: schema.project,
    configureCypress: schema.configureCypress,
    js: schema.js,
    linter: schema.linter,
    cypressDirectory: schema.cypressDirectory,
    tsConfiguration: schema.tsConfiguration ?? true, // default is true
    interactionTests: schema.interactionTests ?? true, // default is true
    configureStaticServe: schema.configureStaticServe,
    uiFramework: uiFramework as any, // cannot import UiFramework type dynamically
    skipFormat: true,
  });

  if (schema.generateStories) {
    await generateStories(host, schema);
  }

  await formatFiles(host);

  return installTask;
}

export default storybookConfigurationGenerator;
