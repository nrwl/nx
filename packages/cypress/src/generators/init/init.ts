import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  Tree,
  updateJson,
} from '@nrwl/devkit';

import { cypressVersion, nxVersion } from '../../utils/versions';

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

export function cypressInitGenerator(host: Tree) {
  return updateDependencies(host);
}

export default cypressInitGenerator;
export const cypressInitSchematic = convertNxGenerator(cypressInitGenerator);
