import { chain, noop, Rule } from '@angular-devkit/schematics';
import {
  addPackageWithInit,
  formatFiles,
  setDefaultCollection,
  addDepsToPackageJson,
  updateJsonInTree,
} from '@nrwl/workspace';
import {
  expressTypingsVersion,
  expressVersion,
  nxVersion,
} from '../../utils/versions';
import { Schema } from './schema';

function removeNrwlExpressFromDeps(): Rule {
  return updateJsonInTree('package.json', (json) => {
    delete json.dependencies['@nrwl/express'];
    return json;
  });
}

export default function (schema: Schema) {
  return chain([
    setDefaultCollection('@nrwl/express'),
    addPackageWithInit('@nrwl/node', schema),
    schema.unitTestRunner === 'jest'
      ? addPackageWithInit('@nrwl/jest')
      : noop(),
    removeNrwlExpressFromDeps(),
    addDepsToPackageJson(
      {
        express: expressVersion,
        tslib: '^2.0.0',
      },
      {
        '@types/express': expressTypingsVersion,
        '@nrwl/express': nxVersion,
      }
    ),
    formatFiles(schema),
  ]);
}
