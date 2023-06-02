import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  GeneratorCallback,
  readNxJson,
  removeDependenciesFromPackageJson,
  runTasksInSerial,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import {
  cypressVersion,
  nxVersion,
  typesNodeVersion,
} from '../../utils/versions';
import { Schema } from './schema';
import { initGenerator } from '@nx/js';

function setupE2ETargetDefaults(tree: Tree) {
  const nxJson = readNxJson(tree);

  if (!nxJson.namedInputs) {
    return;
  }

  // E2e targets depend on all their project's sources + production sources of dependencies
  nxJson.targetDefaults ??= {};

  const productionFileSet = !!nxJson.namedInputs?.production;
  nxJson.targetDefaults.e2e ??= {};
  nxJson.targetDefaults.e2e.inputs ??= [
    'default',
    productionFileSet ? '^production' : '^default',
  ];

  updateNxJson(tree, nxJson);
}

function updateDependencies(tree: Tree) {
  removeDependenciesFromPackageJson(tree, ['@nx/cypress'], []);

  return addDependenciesToPackageJson(
    tree,
    {},
    {
      ['@nx/cypress']: nxVersion,
      cypress: cypressVersion,
      '@types/node': typesNodeVersion,
    }
  );
}

export async function cypressInitGenerator(tree: Tree, options: Schema) {
  setupE2ETargetDefaults(tree);

  const tasks: GeneratorCallback[] = [];

  tasks.push(
    await initGenerator(tree, {
      ...options,
      skipFormat: true,
    })
  );

  if (!options.skipPackageJson) {
    tasks.push(updateDependencies(tree));
  }

  return runTasksInSerial(...tasks);
}

export default cypressInitGenerator;
export const cypressInitSchematic = convertNxGenerator(cypressInitGenerator);
