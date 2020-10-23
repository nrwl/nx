import { chain, noop } from '@angular-devkit/schematics';
import {
  addDepsToPackageJson,
  addPackageWithInit,
  setDefaultCollection,
} from '@nrwl/workspace';
import { nextVersion } from '../../utils/versions';
import { Schema } from './schema';
import { reactDomVersion, reactVersion } from '@nrwl/react/src/utils/versions';

const updateDependencies = addDepsToPackageJson(
  {
    next: nextVersion,
    react: reactVersion,
    'react-dom': reactDomVersion,
    tslib: '^2.0.0',
  },
  {}
);

export default function (schema: Schema) {
  return chain([
    setDefaultCollection('@nrwl/next'),
    schema.unitTestRunner === 'jest'
      ? addPackageWithInit('@nrwl/jest')
      : noop(),
    schema.e2eTestRunner === 'cypress'
      ? addPackageWithInit('@nrwl/cypress')
      : noop(),
    addPackageWithInit('@nrwl/web', schema),
    addPackageWithInit('@nrwl/react', schema),
    updateDependencies,
  ]);
}
