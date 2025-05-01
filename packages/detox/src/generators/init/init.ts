import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  formatFiles,
  GeneratorCallback,
  readNxJson,
  removeDependenciesFromPackageJson,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { addPlugin } from '@nx/devkit/src/utils/add-plugin';
import { createNodesV2 } from '../../plugins/plugin';
import { detoxVersion, nxVersion } from '../../utils/versions';
import { Schema } from './schema';

export function detoxInitGenerator(host: Tree, schema: Schema) {
  return detoxInitGeneratorInternal(host, { addPlugin: false, ...schema });
}

export async function detoxInitGeneratorInternal(host: Tree, schema: Schema) {
  const tasks: GeneratorCallback[] = [];

  const nxJson = readNxJson(host);
  const addPluginDefault =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;

  schema.addPlugin ??= addPluginDefault;

  if (!schema.skipPackageJson) {
    tasks.push(moveDependency(host));
    tasks.push(updateDependencies(host, schema));
  }

  if (schema.addPlugin) {
    await addPlugin(
      host,
      await createProjectGraphAsync(),
      '@nx/detox/plugin',
      createNodesV2,
      {
        buildTargetName: ['build', 'detox:build', 'detox-build'],
        startTargetName: ['start', 'detox:start', 'detox-start'],
        testTargetName: ['test', 'detox:test', 'detox-test'],
        buildDepsTargetName: [
          'build-deps',
          'detox:build-deps',
          'detox-build-deps',
        ],
        watchDepsTargetName: [
          'watch-deps',
          'detox:watch-deps',
          'detox-watch-deps',
        ],
      },
      schema.updatePackageScripts
    );
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

export default detoxInitGenerator;
