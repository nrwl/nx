import {
  addDependenciesToPackageJson,
  ensurePackage,
  formatFiles,
  GeneratorCallback,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import {
  nxVersion,
  reactNativeAsyncStorageVersion,
  reactNativeSafeAreaContextVersion,
} from '../../utils/versions';

import storiesGenerator from '../stories/stories';
import { addResolverMainFieldsToMetroConfig } from './lib/add-resolver-main-fields-to-metro-config';
import { createStorybookFiles } from './lib/create-storybook-files';
import { replaceAppImportWithStorybookToggle } from './lib/replace-app-import-with-storybook-toggle';

import { StorybookConfigureSchema } from './schema';

async function generateStories(host: Tree, schema: StorybookConfigureSchema) {
  await storiesGenerator(host, {
    project: schema.name,
    ignorePaths: schema.ignorePaths,
    skipFormat: true,
  });
}

export function storybookConfigurationGenerator(
  tree: Tree,
  schema: StorybookConfigureSchema
) {
  return storybookConfigurationGeneratorInternal(tree, {
    addPlugin: false,
    ...schema,
  });
}

export async function storybookConfigurationGeneratorInternal(
  host: Tree,
  schema: StorybookConfigureSchema
): Promise<GeneratorCallback> {
  const { configurationGenerator } = ensurePackage<
    typeof import('@nx/storybook')
  >('@nx/storybook', nxVersion);

  schema.addPlugin ??= process.env.NX_ADD_PLUGINS !== 'false';

  const installTask = await configurationGenerator(host, {
    project: schema.name,
    uiFramework: '@storybook/react-native',
    configureCypress: false,
    js: false,
    linter: schema.linter,
    standaloneConfig: schema.standaloneConfig,
    tsConfiguration: schema.tsConfiguration,
    skipFormat: true,
    addPlugin: schema.addPlugin,
  });

  const installRequiredPackagesTask = await addDependenciesToPackageJson(
    host,
    {},
    {
      '@react-native-async-storage/async-storage':
        reactNativeAsyncStorageVersion,
      'react-native-safe-area-context': reactNativeSafeAreaContextVersion,
    }
  );

  addStorybookTask(host, schema.name);
  createStorybookFiles(host, schema);
  replaceAppImportWithStorybookToggle(host, schema);
  addResolverMainFieldsToMetroConfig(host, schema);

  if (schema.generateStories) {
    await generateStories(host, schema);
  }

  await formatFiles(host);
  return runTasksInSerial(installTask, installRequiredPackagesTask);
}

function addStorybookTask(host: Tree, projectName: string) {
  const projectConfig = readProjectConfiguration(host, projectName);
  projectConfig.targets['storybook'] = {
    executor: '@nx/react-native:storybook',
    options: {
      searchDir: [projectConfig.sourceRoot],
      outputFile: './.storybook/story-loader.js',
      pattern: '**/*.stories.@(js|jsx|ts|tsx|md)',
    },
  };

  updateProjectConfiguration(host, projectName, projectConfig);
}

export default storybookConfigurationGenerator;
