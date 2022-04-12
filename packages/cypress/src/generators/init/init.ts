import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  removeDependenciesFromPackageJson,
  Tree,
} from '@nrwl/devkit';
import { cypressVersion, nxVersion } from '../../utils/versions';
import { Schema } from './schema';

function updateDependencies(host: Tree) {
  removeDependenciesFromPackageJson(host, ['@nrwl/cypress'], []);

  return addDependenciesToPackageJson(
    host,
    {},
    {
      ['@nrwl/cypress']: nxVersion,
      cypress: cypressVersion,
    }
  );
}

export function cypressInitGenerator(host: Tree, options: Schema) {
  return !options.skipPackageJson ? updateDependencies(host) : () => {};
}

export default cypressInitGenerator;
export const cypressInitSchematic = convertNxGenerator(cypressInitGenerator);
