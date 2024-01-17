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
import { cypressVersion, nxVersion } from '../../utils/versions';
import { Schema } from './schema';
import { CypressPluginOptions } from '../../plugins/plugin';

function setupE2ETargetDefaults(tree: Tree) {
  const nxJson = readNxJson(tree);

  if (!nxJson.namedInputs) {
    return;
  }

  // E2e targets depend on all their project's sources + production sources of dependencies
  nxJson.targetDefaults ??= {};

  const productionFileSet = !!nxJson.namedInputs?.production;
  nxJson.targetDefaults.e2e ??= {};
  nxJson.targetDefaults.e2e.cache ??= true;
  nxJson.targetDefaults.e2e.inputs ??= [
    'default',
    productionFileSet ? '^production' : '^default',
  ];

  updateNxJson(tree, nxJson);
}

function updateDependencies(tree: Tree) {
  const tasks: GeneratorCallback[] = [];
  tasks.push(removeDependenciesFromPackageJson(tree, ['@nx/cypress'], []));

  tasks.push(
    addDependenciesToPackageJson(
      tree,
      {},
      {
        ['@nx/cypress']: nxVersion,
        cypress: cypressVersion,
      }
    )
  );

  return runTasksInSerial(...tasks);
}

function addPlugin(tree: Tree) {
  const nxJson = readNxJson(tree);
  nxJson.plugins ??= [];

  for (const plugin of nxJson.plugins) {
    if (
      typeof plugin === 'string'
        ? plugin === '@nx/cypress/plugin'
        : plugin.plugin === '@nx/cypress/plugin'
    ) {
      return;
    }
  }

  nxJson.plugins.push({
    plugin: '@nx/cypress/plugin',
    options: {
      targetName: 'e2e',
      componentTestingTargetName: 'component-test',
    } as CypressPluginOptions,
  });
  updateNxJson(tree, nxJson);
}

function updateProductionFileset(tree: Tree) {
  const nxJson = readNxJson(tree);

  const productionFileset = nxJson.namedInputs?.production;
  if (productionFileset) {
    nxJson.namedInputs.production = Array.from(
      new Set([
        ...productionFileset,
        '!{projectRoot}/cypress/**/*',
        '!{projectRoot}/**/*.cy.[jt]s?(x)',
        '!{projectRoot}/cypress.config.[jt]s',
      ])
    );
  }
  updateNxJson(tree, nxJson);
}

export async function cypressInitGenerator(tree: Tree, options: Schema) {
  updateProductionFileset(tree);

  if (process.env.NX_PCV3 === 'true') {
    addPlugin(tree);
  } else {
    setupE2ETargetDefaults(tree);
  }

  let installTask: GeneratorCallback = () => {};
  if (!options.skipPackageJson) {
    installTask = updateDependencies(tree);
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return installTask;
}

export default cypressInitGenerator;
