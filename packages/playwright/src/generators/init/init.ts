import {
  addDependenciesToPackageJson,
  formatFiles,
  GeneratorCallback,
  readNxJson,
  runTasksInSerial,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import { updatePackageScripts } from '@nx/devkit/src/utils/update-package-scripts';
import { createNodes } from '../../plugins/plugin';
import { nxVersion, playwrightVersion } from '../../utils/versions';
import { InitGeneratorSchema } from './schema';

export async function initGenerator(tree: Tree, options: InitGeneratorSchema) {
  const tasks: GeneratorCallback[] = [];

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

  if (process.env.NX_ADD_PLUGINS !== 'false') {
    addPlugin(tree);
  }

  if (options.updatePackageScripts) {
    await updatePackageScripts(tree, createNodes);
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

function addPlugin(tree: Tree) {
  const nxJson = readNxJson(tree);
  nxJson.plugins ??= [];

  if (
    !nxJson.plugins.some((p) =>
      typeof p === 'string'
        ? p === '@nx/playwright/plugin'
        : p.plugin === '@nx/playwright/plugin'
    )
  ) {
    nxJson.plugins.push({
      plugin: '@nx/playwright/plugin',
      options: {
        targetName: 'e2e',
      },
    });
    updateNxJson(tree, nxJson);
  }
}

export default initGenerator;
