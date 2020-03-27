import { chain, noop } from '@angular-devkit/schematics';
import { addDepsToPackageJson, addPackageWithInit } from '@nrwl/workspace';
import {
  nextVersion,
  zeitNextCss,
  zeitNextLess,
  zeitNextSass,
  zeitNextStylus
} from '../../utils/versions';
import { Schema } from './schema';
import { setDefaultCollection } from '@nrwl/workspace/src/utils/rules/workspace';

const updateDependencies = addDepsToPackageJson(
  {
    next: nextVersion
  },
  {}
);

export default function(schema: Schema) {
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
    updateDependencies
  ]);
}
