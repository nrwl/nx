import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  readWorkspaceConfiguration,
  removeDependenciesFromPackageJson,
  Tree,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';
import {
  cypressVersion,
  nxVersion,
  typesNodeVersion,
} from '../../utils/versions';
import { Schema } from './schema';

function setupE2ETargetDefaults(tree: Tree) {
  const workspaceConfiguration = readWorkspaceConfiguration(tree);

  if (!workspaceConfiguration.namedInputs) {
    return;
  }

  // E2e targets depend on all their project's sources + production sources of dependencies
  workspaceConfiguration.targetDefaults ??= {};

  const productionFileSet = !!workspaceConfiguration.namedInputs?.production;
  workspaceConfiguration.targetDefaults.e2e ??= {};
  workspaceConfiguration.targetDefaults.e2e.inputs ??= [
    'default',
    productionFileSet ? '^production' : '^default',
  ];

  updateWorkspaceConfiguration(tree, workspaceConfiguration);
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
