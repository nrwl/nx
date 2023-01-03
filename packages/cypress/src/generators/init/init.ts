import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  readNxJson,
  removeDependenciesFromPackageJson,
  Tree,
  updateNxJson,
} from '@nrwl/devkit';
import {
  cypressVersion,
  nxVersion,
  typesNodeVersion,
} from '../../utils/versions';
import { Schema } from './schema';

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
  removeDependenciesFromPackageJson(tree, ['@nrwl/cypress'], []);

  return addDependenciesToPackageJson(
    tree,
    {},
    {
      ['@nrwl/cypress']: nxVersion,
      cypress: cypressVersion,
      '@types/node': typesNodeVersion,
    }
  );
}

export function cypressInitGenerator(tree: Tree, options: Schema) {
  setupE2ETargetDefaults(tree);
  return !options.skipPackageJson ? updateDependencies(tree) : () => {};
}

export default cypressInitGenerator;
export const cypressInitSchematic = convertNxGenerator(cypressInitGenerator);
