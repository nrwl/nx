import {
  type Tree,
  type GeneratorCallback,
  readNxJson,
  createProjectGraphAsync,
  addDependenciesToPackageJson,
  formatFiles,
  runTasksInSerial,
  logger,
  updateNxJson,
} from '@nx/devkit';
import { addPlugin } from '@nx/devkit/src/utils/add-plugin';
import { InitGeneratorSchema } from './schema';
import { createNodesV2 } from '../../plugins/plugin';
import { nxVersion } from '../../utils/versions';

export function updateDependencies(tree: Tree, schema: InitGeneratorSchema) {
  return addDependenciesToPackageJson(
    tree,
    {},
    {
      '@nx/docker': nxVersion,
    },
    undefined,
    schema.keepExistingVersions
  );
}

function addPluginToNxJson(tree: Tree, updatePackageScripts: boolean) {
  if (!tree.exists('nx.json')) {
    logger.warn(
      '"nx.json" not found. Skipping "@nx/docker" plugin registration.'
    );
    return;
  }

  const nxJson = readNxJson(tree);
  if (!nxJson) {
    logger.warn(
      'Unable to read "nx.json" content. Skipping "@nx/docker" plugin registration.'
    );
    return;
  }

  nxJson.plugins ??= [];
  const pluginExists = nxJson.plugins.some((plugin) =>
    typeof plugin === 'string'
      ? plugin === '@nx/docker'
      : plugin?.plugin === '@nx/docker'
  );
  if (pluginExists) {
    logger.info('"@nx/docker" plugin is already registered in "nx.json".');
    return;
  }

  nxJson.plugins.push({
    plugin: '@nx/docker',
    options: {
      buildTarget: { name: 'docker:build' },
      runTarget: { name: 'docker:run' },
    },
  });
  updateNxJson(tree, nxJson);
  logger.info('Added "@nx/docker" to plugins array in "nx.json".');
}

export async function initGenerator(tree: Tree, schema: InitGeneratorSchema) {
  logger.warn(
    `Docker support is experimental. Breaking changes may occur and not adhere to semver versioning.`
  );

  const tasks: GeneratorCallback[] = [];
  if (!schema.skipPackageJson && tree.exists('package.json')) {
    tasks.push(updateDependencies(tree, schema));
  }

  addPluginToNxJson(tree, schema.updatePackageScripts);

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default initGenerator;
