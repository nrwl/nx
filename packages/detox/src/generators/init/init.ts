import { acknowledgeBuildScripts, addPlugin } from '@nx/devkit/internal';
import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  detectPackageManager,
  formatFiles,
  GeneratorCallback,
  readNxJson,
  removeDependenciesFromPackageJson,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { createNodesV2 } from '../../plugins/plugin';
import {
  assertSupportedDetoxVersion,
  detoxVersion,
  nxVersion,
} from '../../utils/versions';
import { Schema } from './schema';

export function detoxInitGenerator(host: Tree, schema: Schema) {
  return detoxInitGeneratorInternal(host, { addPlugin: false, ...schema });
}

export async function detoxInitGeneratorInternal(host: Tree, schema: Schema) {
  assertSupportedDetoxVersion(host);

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
  // detox's postinstall builds its framework cache; without it detox cannot run.
  acknowledgeBuildScripts(host, detectPackageManager(host.root), {
    detox: true,
  });
  return addDependenciesToPackageJson(
    host,
    {},
    {
      '@nx/detox': nxVersion,
      detox: detoxVersion,
    },
    undefined,
    schema.keepExistingVersions ?? true
  );
}

function moveDependency(host: Tree) {
  return removeDependenciesFromPackageJson(host, ['@nx/detox'], []);
}

export default detoxInitGenerator;
