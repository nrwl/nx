import { Rule, Tree } from '@angular-devkit/schematics';

import { Schema } from './schema';
import { cypressVersion, nxVersion } from '../../utils/versions';
import { readJsonInTree, updateJsonInTree } from '@nrwl/workspace';

function updateDependencies(): Rule {
  return (host: Tree): Rule => {
    const packageJson = readJsonInTree(host, 'package.json');
    const devDependencies = { ...packageJson.devDependencies };
    const dependencies = { ...packageJson.dependencies };
    if (!devDependencies['cypress']) {
      devDependencies['cypress'] = cypressVersion;
    }
    if (!devDependencies['@nrwl/cypress']) {
      devDependencies['@nrwl/cypress'] = nxVersion;
    }
    if (packageJson.dependencies['@nrwl/cypress']) {
      delete dependencies['@nrwl/cypress'];
    }

    return updateJsonInTree('package.json', (json) => {
      json.dependencies = dependencies;
      json.devDependencies = devDependencies;
      return json;
    });
  };
}

export default function (schema: Schema) {
  return updateDependencies();
}
