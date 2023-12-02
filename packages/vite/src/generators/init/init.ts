import { readNxJson, runTasksInSerial, Tree, updateNxJson } from '@nx/devkit';

import { initGenerator as jsInitGenerator } from '@nx/js';

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

  nxJson.targetDefaults ??= {};
  nxJson.targetDefaults['@nx/vite:test'] ??= {};
  nxJson.targetDefaults['@nx/vite:test'].cache ??= true;
  nxJson.targetDefaults['@nx/vite:test'].inputs ??= [
    'default',
    productionFileSet ? '^production' : '^default',
  ];
  nxJson.targetDefaults['@nx/vite:test'].options ??= {
    passWithNoTests: true,
    reporters: ['default'],
  };

  nxJson.targetDefaults['@nx/vite:build'] ??= {};

  nxJson.targetDefaults['@nx/vite:build'].options ??= {
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  };

  updateNxJson(tree, nxJson);
}

export async function initGenerator(tree: Tree, schema: InitGeneratorSchema) {
  moveToDevDependencies(tree);
  updateNxJsonSettings(tree);
  const tasks = [];

  tasks.push(
    await jsInitGenerator(tree, {
      ...schema,
      skipFormat: true,
      tsConfigName: schema.rootProject ? 'tsconfig.json' : 'tsconfig.base.json',
    })
  );
  const addPlugins = process.env.NX_PCV3 === 'true';
  if (addPlugins) {
    addPlugin(tree);
  }
  tasks.push(checkDependenciesInstalled(tree, schema));
  return runTasksInSerial(...tasks);
}

export default initGenerator;
