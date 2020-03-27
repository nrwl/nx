import { chain, noop, Rule } from '@angular-devkit/schematics';
import {
  addPackageWithInit,
  formatFiles,
  updateJsonInTree
} from '@nrwl/workspace';
import { nxVersion } from '../../utils/versions';
import { Schema } from './schema';
import { setDefaultCollection } from '@nrwl/workspace/src/utils/rules/workspace';

function updateDependencies(): Rule {
  return updateJsonInTree('package.json', json => {
    delete json.dependencies['@nrwl/node'];
    json.devDependencies['@nrwl/node'] = nxVersion;
    return json;
  });
}

export default function(schema: Schema) {
  return chain([
    setDefaultCollection('@nrwl/node'),
    schema.unitTestRunner === 'jest'
      ? addPackageWithInit('@nrwl/jest')
      : noop(),
    updateDependencies(),
    formatFiles(schema)
  ]);
}
