import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  Tree,
  updateJson,
} from '@nrwl/devkit';

import { cypressVersion, nxVersion } from '../../utils/versions';
import { Schema } from './schema';

function updateDependencies(host: Tree) {
  updateJson(host, 'package.json', (json) => {
    json.dependencies = json.dependencies || {};
    delete json.dependencies['@nrwl/cypress'];

    return json;
  });
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
