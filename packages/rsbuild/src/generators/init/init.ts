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
import { nxVersion, rsbuildVersion } from '../../utils/versions';

export function updateDependencies(tree: Tree, schema: InitGeneratorSchema) {
  return addDependenciesToPackageJson(
    tree,
    {},
    {
      '@nx/rsbuild': nxVersion,
      '@rsbuild/core': rsbuildVersion,
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
      '@nx/rsbuild',
      createNodesV2,
      {
        buildTargetName: ['build', 'rsbuild:build', 'rsbuild-build'],
        devTargetName: ['dev', 'rsbuild:dev', 'rsbuild-dev'],
        previewTargetName: ['preview', 'rsbuild:preview', 'rsbuild-preview'],
        inspectTargetName: ['inspect', 'rsbuild:inspect', 'rsbuild-inspect'],
        typecheckTargetName: [
          'typecheck',
          'rsbuild:typecheck',
          'rsbuild-typecheck',
        ],
        buildDepsTargetName: [
          'build-deps',
          'rsbuild:build-deps',
          'rsbuild-build-deps',
        ],
        watchDepsTargetName: [
          'watch-deps',
          'rsbuild:watch-deps',
          'rsbuild-watch-deps',
        ],
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
