import { StorybookConfigureSchema } from './schema';
import storiesGenerator from '../stories/stories';
import {
  ensurePackage,
  formatFiles,
  joinPathFragments,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { nxVersion } from '../../utils/versions';

async function generateStories(host: Tree, schema: StorybookConfigureSchema) {
  // TODO(katerina): Nx 19 -> remove Cypress
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

export function storybookConfigurationGenerator(
  host: Tree,
  schema: StorybookConfigureSchema
) {
  return storybookConfigurationGeneratorInternal(host, {
    addPlugin: false,
    ...schema,
  });
}

export async function storybookConfigurationGeneratorInternal(
  host: Tree,
  schema: StorybookConfigureSchema
) {
  schema.addPlugin ??= process.env.NX_ADD_PLUGINS !== 'false';
  const { configurationGenerator } = ensurePackage<
    typeof import('@nx/storybook')
  >('@nx/storybook', nxVersion);

  let uiFramework = '@storybook/react-vite';
  const projectConfig = readProjectConfiguration(host, schema.project);

  if (
    findWebpackConfig(host, projectConfig.root) ||
    projectConfig.targets['build']?.executor === '@nx/rollup:rollup' ||
    projectConfig.targets['build']?.executor === '@nrwl/rollup:rollup' ||
    projectConfig.targets['build']?.executor === '@nx/expo:build'
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
    addPlugin: schema.addPlugin,
  });

  if (schema.generateStories) {
    await generateStories(host, schema);
  }

  await formatFiles(host);

  return installTask;
}

export default storybookConfigurationGenerator;

export function findWebpackConfig(
  tree: Tree,
  projectRoot: string
): string | undefined {
  const allowsExt = ['js', 'mjs', 'ts', 'cjs', 'mts', 'cts'];

  for (const ext of allowsExt) {
    const webpackConfigPath = joinPathFragments(
      projectRoot,
      `webpack.config.${ext}`
    );
    if (tree.exists(webpackConfigPath)) {
      return webpackConfigPath;
    }
  }
}
