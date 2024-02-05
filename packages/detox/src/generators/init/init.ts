import {
  addDependenciesToPackageJson,
  formatFiles,
  GeneratorCallback,
  readNxJson,
  removeDependenciesFromPackageJson,
  runTasksInSerial,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import { updatePackageScripts } from '@nx/devkit/src/utils/update-package-scripts';
import { createNodes, DetoxPluginOptions } from '../../plugins/plugin';
import { detoxVersion, nxVersion } from '../../utils/versions';
import { Schema } from './schema';

export function detoxInitGenerator(host: Tree, schema: Schema) {
  return detoxInitGeneratorInternal(host, { addPlugin: false, ...schema });
}

export async function detoxInitGeneratorInternal(host: Tree, schema: Schema) {
  const tasks: GeneratorCallback[] = [];

  schema.addPlugin ??= process.env.NX_ADD_PLUGINS !== 'false';

  if (!schema.skipPackageJson) {
    tasks.push(moveDependency(host));
    tasks.push(updateDependencies(host, schema));
  }

  if (schema.addPlugin) {
    addPlugin(host);
  }

  if (schema.updatePackageScripts) {
    await updatePackageScripts(host, createNodes);
  }

  if (!schema.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(...tasks);
}

export function updateDependencies(host: Tree, schema: Schema) {
  return addDependenciesToPackageJson(
    host,
    {},
    {
      '@nx/detox': nxVersion,
      detox: detoxVersion,
    },
    undefined,
    schema.keepExistingVersions
  );
}

function moveDependency(host: Tree) {
  return removeDependenciesFromPackageJson(host, ['@nx/detox'], []);
}

function addPlugin(host: Tree) {
  const nxJson = readNxJson(host);
  nxJson.plugins ??= [];

  for (const plugin of nxJson.plugins) {
    if (
      typeof plugin === 'string'
        ? plugin === '@nx/detox/plugin'
        : plugin.plugin === '@nx/detox/plugin'
    ) {
      return;
    }
  }

  nxJson.plugins.push({
    plugin: '@nx/detox/plugin',
    options: {
      buildTargetName: 'build',
      startTargetName: 'start',
      testTargetName: 'test',
    } as DetoxPluginOptions,
  });
  updateNxJson(host, nxJson);
}

export default detoxInitGenerator;
