import { readNxJson, runTasksInSerial, Tree, updateNxJson } from '@nx/devkit';

import { initGenerator as jsInitGenerator } from '@nx/js';

import { InitGeneratorSchema } from './schema';
import {
  addPlugin,
  checkDependenciesInstalled,
  moveToDevDependencies,
} from './lib/utils';

export function updateProductionFileset(tree: Tree) {
  const nxJson = readNxJson(tree);

  const productionFileSet = nxJson.namedInputs?.production;
  if (productionFileSet) {
    productionFileSet.push(
      '!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)',
      '!{projectRoot}/tsconfig.spec.json'
    );

    nxJson.namedInputs.production = Array.from(new Set(productionFileSet));
  }

  updateNxJson(tree, nxJson);
}

export async function initGenerator(tree: Tree, schema: InitGeneratorSchema) {
  moveToDevDependencies(tree);
  updateProductionFileset(tree);
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
  } else {
    addTargetDefaults(tree);
  }
  tasks.push(checkDependenciesInstalled(tree, schema));
  return runTasksInSerial(...tasks);
}

function addTargetDefaults(tree: Tree) {
  const nxJson = readNxJson(tree);

  const productionFileSet = nxJson.namedInputs?.production;

  nxJson.targetDefaults ??= {};
  nxJson.targetDefaults['@nx/vite:test'] ??= {};
  nxJson.targetDefaults['@nx/vite:test'].cache ??= true;
  nxJson.targetDefaults['@nx/vite:test'].inputs ??= [
    'default',
    productionFileSet ? '^production' : '^default',
  ];

  // TODO(@mandarini): move this to the vite.config.ts file
  nxJson.targetDefaults['@nx/vite:test'].options ??= {
    passWithNoTests: true,
    reporters: ['default'],
  };

  nxJson.targetDefaults['@nx/vite:build'] ??= {};
  nxJson.targetDefaults['@nx/vite:build'].cache ??= true;
  nxJson.targetDefaults['@nx/vite:build'].dependsOn ??= ['^build'];
  nxJson.targetDefaults['@nx/vite:build'].inputs ??= productionFileSet
    ? ['production', '^production']
    : ['default', '^default'];

  // TODO(@mandarini): move this to the vite.config.ts file
  nxJson.targetDefaults['@nx/vite:build'].options ??= {
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  };

  updateNxJson(tree, nxJson);
}

export default initGenerator;
