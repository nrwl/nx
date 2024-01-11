import {
  formatFiles,
  GeneratorCallback,
  readNxJson,
  Tree,
  updateNxJson,
} from '@nx/devkit';

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

export async function initGenerator(tree: Tree, schema: InitGeneratorSchema) {
  moveToDevDependencies(tree);
  updateNxJsonSettings(tree);

  const addPlugins = process.env.NX_PCV3 === 'true';
  if (addPlugins) {
    addPlugin(tree);
  }

  let installTask: GeneratorCallback = () => {};
  if (!schema.skipPackageJson) {
    installTask = checkDependenciesInstalled(tree, schema);
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return installTask;
}

export default initGenerator;
