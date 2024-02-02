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
import { updatePackageScripts } from '@nx/devkit/src/utils/update-package-scripts';
import { createNodes } from '../../plugins/plugin';
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

function updateDependencies(tree: Tree, options: Schema) {
  const tasks: GeneratorCallback[] = [];
  tasks.push(removeDependenciesFromPackageJson(tree, ['@nx/cypress'], []));

  tasks.push(
    addDependenciesToPackageJson(
      tree,
      {},
      {
        ['@nx/cypress']: nxVersion,
        cypress: cypressVersion,
      },
      undefined,
      options.keepExistingVersions
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
  return cypressInitGeneratorInternal(tree, { addPlugin: false, ...options });
}

export async function cypressInitGeneratorInternal(
  tree: Tree,
  options: Schema
) {
  updateProductionFileset(tree);

  options.addPlugin ??= process.env.NX_ADD_PLUGINS !== 'false';

  if (options.addPlugin) {
    addPlugin(tree);
  } else {
    setupE2ETargetDefaults(tree);
  }

  let installTask: GeneratorCallback = () => {};
  if (!options.skipPackageJson) {
    installTask = updateDependencies(tree, options);
  }

  if (options.updatePackageScripts) {
    global.NX_CYPRESS_INIT_GENERATOR_RUNNING = true;
    await updatePackageScripts(tree, createNodes);
    global.NX_CYPRESS_INIT_GENERATOR_RUNNING = false;
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return installTask;
}

export default cypressInitGenerator;
