import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  formatFiles,
  GeneratorCallback,
  readNxJson,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { addPlugin } from '@nx/devkit/src/utils/add-plugin';
import { createNodesV2 } from '../../plugins/plugin';
import { nxVersion, playwrightVersion } from '../../utils/versions';
import { InitGeneratorSchema } from './schema';
import { addTargetDefault } from '@nx/devkit/src/generators/target-defaults-utils';

export function initGenerator(tree: Tree, options: InitGeneratorSchema) {
  return initGeneratorInternal(tree, { addPlugin: false, ...options });
}

export async function initGeneratorInternal(
  tree: Tree,
  options: InitGeneratorSchema
) {
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
        options.keepExistingVersions
      )
    );
  }

  if (options.addPlugin) {
    const pluginOptions = await addPlugin(
      tree,
      await createProjectGraphAsync(),
      '@nx/playwright/plugin',
      createNodesV2,
      {
        targetName: ['e2e', 'playwright:e2e', 'playwright-e2e'],
        ciTargetName: ['e2e-ci', 'playwright:e2e-ci', 'playwright-e2e-ci'],
      },
      options.updatePackageScripts
    );

    if (pluginOptions?.ciTargetName) {
      const ciTargetNameGlob = `${pluginOptions.ciTargetName}--**/*`;
      addTargetDefault(tree, ciTargetNameGlob, {
        dependsOn: ['^build'],
      });
    }
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default initGenerator;
