import {
  createProjectGraphAsync,
  formatFiles,
  GeneratorCallback,
  readNxJson,
  runTasksInSerial,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import { addPluginV1 } from '@nx/devkit/src/utils/add-plugin';

import { setupPathsPlugin } from '../setup-paths-plugin/setup-paths-plugin';
import { createNodes } from '../../plugins/plugin';
import { InitGeneratorSchema } from './schema';
import { checkDependenciesInstalled, moveToDevDependencies } from './lib/utils';

export function updateNxJsonSettings(tree: Tree) {
  const nxJson = readNxJson(tree);

  const productionFileSet = nxJson.namedInputs?.production;
  if (productionFileSet) {
    productionFileSet.push(
      '!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)',
      '!{projectRoot}/tsconfig.spec.json'
    );

    nxJson.namedInputs.production = Array.from(new Set(productionFileSet));
  }

  const hasPlugin = nxJson.plugins?.some((p) =>
    typeof p === 'string'
      ? p === '@nx/vite/plugin'
      : p.plugin === '@nx/vite/plugin'
  );

  if (!hasPlugin) {
    nxJson.targetDefaults ??= {};
    nxJson.targetDefaults['@nx/vite:test'] ??= {};
    nxJson.targetDefaults['@nx/vite:test'].cache ??= true;
    nxJson.targetDefaults['@nx/vite:test'].inputs ??= [
      'default',
      productionFileSet ? '^production' : '^default',
    ];
  }

  updateNxJson(tree, nxJson);
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
    await addPluginV1(
      tree,
      await createProjectGraphAsync(),
      '@nx/vite/plugin',
      createNodes,
      {
        buildTargetName: ['build', 'vite:build', 'vite-build'],
        testTargetName: ['test', 'vite:test', 'vite-test'],
        serveTargetName: ['serve', 'vite:serve', 'vite-serve'],
        previewTargetName: ['preview', 'vite:preview', 'vite-preview'],
        serveStaticTargetName: [
          'serve-static',
          'vite:serve-static',
          'vite-serve-static',
        ],
      },
      schema.updatePackageScripts
    );
  }

  updateNxJsonSettings(tree);

  if (schema.setupPathsPlugin) {
    await setupPathsPlugin(tree, { skipFormat: true });
  }

  const tasks: GeneratorCallback[] = [];
  if (!schema.skipPackageJson) {
    tasks.push(moveToDevDependencies(tree));
    tasks.push(checkDependenciesInstalled(tree, schema));
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default initGenerator;
