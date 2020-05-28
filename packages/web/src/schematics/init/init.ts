import { chain, noop, Rule } from '@angular-devkit/schematics';
import {
  addPackageWithInit,
  formatFiles,
  setDefaultCollection,
  updateJsonInTree,
} from '@nrwl/workspace';
import { Schema } from './schema';
import {
  documentRegisterElementVersion,
  nxVersion,
} from '../../utils/versions';

function updateDependencies(): Rule {
  return updateJsonInTree('package.json', (json) => {
    delete json.dependencies['@nrwl/web'];
    json.dependencies = {
      ...json.dependencies,
      'document-register-element': documentRegisterElementVersion,
    };
    json.devDependencies = {
      ...json.devDependencies,
      '@nrwl/web': nxVersion,
    };
    return json;
  });
}

export default function (schema: Schema) {
  return chain([
    setDefaultCollection('@nrwl/web'),
    schema.unitTestRunner === 'jest'
      ? addPackageWithInit('@nrwl/jest')
      : noop(),
    schema.e2eTestRunner === 'cypress'
      ? addPackageWithInit('@nrwl/cypress')
      : noop(),
    updateDependencies(),
    formatFiles(schema),
  ]);
}
