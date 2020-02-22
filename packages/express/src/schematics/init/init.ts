import { chain, Rule } from '@angular-devkit/schematics';
import {
  addPackageWithInit,
  formatFiles,
  updateJsonInTree
} from '@nrwl/workspace';
import {
  expressTypingsVersion,
  expressVersion,
  nxVersion
} from '../../utils/versions';
import { Schema } from './schema';
import { setDefaultCollection } from '@nrwl/workspace/src/utils/rules/workspace';

function updateDependencies(): Rule {
  return updateJsonInTree('package.json', json => {
    delete json.dependencies['@nrwl/express'];
    json.dependencies['express'] = expressVersion;
    json.devDependencies = {
      ...json.devDependencies,
      '@types/express': expressTypingsVersion,
      '@nrwl/express': nxVersion
    };
    return json;
  });
}

export default function(schema: Schema) {
  return chain([
    setDefaultCollection('@nrwl/express'),
    addPackageWithInit('@nrwl/node'),
    addPackageWithInit('@nrwl/jest'),
    updateDependencies(),
    formatFiles(schema)
  ]);
}
