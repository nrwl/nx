import {
  addDependenciesToPackageJson,
  ensurePackage,
  formatFiles,
  type GeneratorCallback,
  runTasksInSerial,
  type Tree,
} from '@nx/devkit';
import { assertSupportedReactVersion } from '../../utils/assert-supported-react-version';
import { getUiFramework } from '../../utils/framework';
import { nxVersion, reactViteVersion } from '../../utils/versions';
import { storiesGenerator } from '../stories/stories';
import type { StorybookConfigureSchema } from './schema';

export function storybookConfigurationGenerator(
  host: Tree,
  schema: StorybookConfigureSchema
) {
  return storybookConfigurationGeneratorInternal(host, schema);
}

export async function storybookConfigurationGeneratorInternal(
  host: Tree,
  schema: StorybookConfigureSchema
) {
  assertSupportedReactVersion(host);

  const tasks: GeneratorCallback[] = [];
  const { configurationGenerator } = ensurePackage<
    typeof import('@nx/storybook')
  >('@nx/storybook', nxVersion);

  const uiFramework = getUiFramework(host, schema.project);

  if (uiFramework === '@storybook/react-vite') {
    tasks.push(
      addDependenciesToPackageJson(
        host,
        {},
        { '@vitejs/plugin-react': reactViteVersion },
        undefined,
        true
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
