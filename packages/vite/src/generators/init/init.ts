import {
  formatFiles,
  GeneratorCallback,
  readNxJson,
  runTasksInSerial,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import { updatePackageScripts } from '@nx/devkit/src/utils/update-package-scripts';

import { createNodes } from '../../plugins/plugin';
import { InitGeneratorSchema } from './schema';
import {
  addPlugin,
  checkDependenciesInstalled,
  moveToDevDependencies,
} from './lib/utils';

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
  schema.addPlugin ??= process.env.NX_ADD_PLUGINS !== 'false';
  if (schema.addPlugin) {
    addPlugin(tree);
  }

  updateNxJsonSettings(tree);

  const tasks: GeneratorCallback[] = [];
  if (!schema.skipPackageJson) {
    tasks.push(moveToDevDependencies(tree));
    tasks.push(checkDependenciesInstalled(tree, schema));
  }

  if (schema.updatePackageScripts) {
    await updatePackageScripts(tree, createNodes);
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default initGenerator;
