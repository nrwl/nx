import { addPlugin } from '@nx/devkit/internal';
import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  formatFiles,
  GeneratorCallback,
  readNxJson,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { createNodesV2 } from '../../plugins/plugin';
import { assertSupportedPlaywrightVersion } from '../../utils/assert-supported-playwright-version';
import { nxVersion, playwrightVersion } from '../../utils/versions';
import { InitGeneratorSchema } from './schema';

export function initGenerator(tree: Tree, options: InitGeneratorSchema) {
  return initGeneratorInternal(tree, { addPlugin: false, ...options });
}

export async function initGeneratorInternal(
  tree: Tree,
  options: InitGeneratorSchema
) {
  assertSupportedPlaywrightVersion(tree);

  const tasks: GeneratorCallback[] = [];

  const nxJson = readNxJson(tree);
  const addPluginDefault =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;

  options.addPlugin ??= addPluginDefault;

  if (!options.skipPackageJson) {
    tasks.push(
      addDependenciesToPackageJson(
        tree,
        {},
        {
          '@nx/playwright': nxVersion,
          '@playwright/test': playwrightVersion,
        },
        undefined,
        options.keepExistingVersions ?? true
      )
    );
  }

  if (options.addPlugin) {
    await addPlugin(
      tree,
      await createProjectGraphAsync(),
      '@nx/playwright/plugin',
      createNodesV2,
      { targetName: ['e2e', 'playwright:e2e', 'playwright-e2e'] },
      options.updatePackageScripts
    );
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default initGenerator;
