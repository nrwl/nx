import {
  type Tree,
  type GeneratorCallback,
  readNxJson,
  createProjectGraphAsync,
  addDependenciesToPackageJson,
  formatFiles,
  runTasksInSerial,
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

export function initGenerator(tree: Tree, schema: InitGeneratorSchema) {
  return initGeneratorInternal(tree, { addPlugin: false, ...schema });
}

export async function initGeneratorInternal(
  tree: Tree,
  schema: InitGeneratorSchema
) {
  const nxJson = readNxJson(tree);
  const addPluginDefault =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;
  schema.addPlugin ??= addPluginDefault;

  if (schema.addPlugin) {
    await addPlugin(
      tree,
      await createProjectGraphAsync(),
      '@nx/docker',
      createNodesV2,
      {
        buildTarget: ['docker:build', 'docker-build', 'build-docker'],
        runTarget: ['docker:run', 'docker-run', 'run-docker'],
      },
      schema.updatePackageScripts
    );
  }

  const tasks: GeneratorCallback[] = [];
  if (!schema.skipPackageJson) {
    tasks.push(updateDependencies(tree, schema));
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default initGenerator;
