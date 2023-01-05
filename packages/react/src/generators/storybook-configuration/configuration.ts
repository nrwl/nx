import { StorybookConfigureSchema } from './schema';
import storiesGenerator from '../stories/stories';
import {
  convertNxGenerator,
  ensurePackage,
  joinPathFragments,
  logger,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { nxVersion } from '../../utils/versions';

async function generateStories(host: Tree, schema: StorybookConfigureSchema) {
  await ensurePackage(host, '@nrwl/cypress', nxVersion);
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
  await ensurePackage(host, '@nrwl/storybook', nxVersion);
  const { configurationGenerator } = await import('@nrwl/storybook');

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

  /**
   * If it's library and there's no .babelrc file,
   * we need to generate one if it's not using vite.
   *
   * The reason is that it will be using webpack for Storybook,
   * and webpack needs the babelrc file to be present.
   *
   * The reason the babelrc file is not there in the first place,
   * is because the vitest generator deletes it, since it
   * does not need it.
   * See:
   * packages/react/src/generators/library/lib/create-files.ts#L42
   */

  if (
    bundler !== 'vite' &&
    projectConfig.projectType === 'library' &&
    !host.exists(joinPathFragments(projectConfig.root, '.babelrc'))
  ) {
    host.write(
      joinPathFragments(projectConfig.root, '.babelrc'),
      JSON.stringify({
        presets: [
          [
            '@nrwl/react/babel',
            {
              runtime: 'automatic',
              useBuiltIns: 'usage',
            },
          ],
        ],
        plugins: [],
      })
    );
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
    bundler,
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
