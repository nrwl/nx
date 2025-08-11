import {
  addDependenciesToPackageJson,
  ensurePackage,
  formatFiles,
  type GeneratorCallback,
  readNxJson,
  runTasksInSerial,
  type Tree,
} from '@nx/devkit';
import { getUiFramework } from '../../utils/framework';
import { nxVersion, reactViteVersion } from '../../utils/versions';
import { storiesGenerator } from '../stories/stories';
import type { StorybookConfigureSchema } from './schema';

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
  const tasks: GeneratorCallback[] = [];
  const nxJson = readNxJson(host);
  const addPluginDefault =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;
  schema.addPlugin ??= addPluginDefault;
  const { configurationGenerator } = ensurePackage<
    typeof import('@nx/storybook')
  >('@nx/storybook', nxVersion);

  const uiFramework = getUiFramework(host, schema.project);

  if (uiFramework === '@storybook/react-vite') {
    tasks.push(
      addDependenciesToPackageJson(
        host,
        {},
        { '@vitejs/plugin-react': reactViteVersion }
      )
    );
  }

  const installTask = await configurationGenerator(host, {
    project: schema.project,
    js: schema.js,
    linter: schema.linter,
    tsConfiguration: schema.tsConfiguration ?? true, // default is true
    interactionTests: schema.interactionTests ?? true, // default is true
    configureStaticServe: schema.configureStaticServe,
    uiFramework: uiFramework as any, // cannot import UiFramework type dynamically
    skipFormat: true,
    addPlugin: schema.addPlugin,
  });

  tasks.push(installTask);

  if (schema.generateStories) {
    await storiesGenerator(host, {
      project: schema.project,
      js: schema.js,
      ignorePaths: schema.ignorePaths,
      skipFormat: true,
      interactionTests: schema.interactionTests ?? true,
      uiFramework,
    });
  }

  await formatFiles(host);

  return runTasksInSerial(...tasks);
}

export default storybookConfigurationGenerator;
