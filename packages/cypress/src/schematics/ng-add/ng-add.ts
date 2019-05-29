import { Rule, Tree, noop, chain } from '@angular-devkit/schematics';

import { Schema } from './schema';
import { cypressVersion, nxVersion } from '../../utils/versions';
import { readJsonInTree } from '@nrwl/workspace';
import { addDepsToPackageJson, updateJsonInTree } from '@nrwl/workspace';

function checkDependenciesInstalled(): Rule {
  return (host: Tree): Rule => {
    const packageJson = readJsonInTree(host, 'package.json');
    const dependencyList: { name: string; version: string }[] = [];
    if (!packageJson.devDependencies.cypress) {
      dependencyList.push({ name: 'cypress', version: cypressVersion });
    }
    if (!packageJson.devDependencies['@nrwl/cypress']) {
      dependencyList.push({ name: '@nrwl/cypress', version: nxVersion });
    }

    if (!dependencyList.length) {
      return noop();
    }

    return addDepsToPackageJson(
      {},
      dependencyList.reduce((dictionary, value) => {
        dictionary[value.name] = value.version;
        return dictionary;
      }, {})
    );
  };
}

function removeDependency() {
  return updateJsonInTree('package.json', json => {
    json.dependencies = json.dependencies || {};
    delete json.dependencies['@nrwl/cypress'];
    return json;
  });
}

export default function(schema: Schema) {
  return chain([removeDependency(), checkDependenciesInstalled()]);
}
