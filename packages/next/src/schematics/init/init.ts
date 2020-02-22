import { chain } from '@angular-devkit/schematics';
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
    next: nextVersion,
    '@zeit/next-css': zeitNextCss,
    '@zeit/next-sass': zeitNextLess,
    '@zeit/next-less': zeitNextSass,
    '@zeit/next-stylus': zeitNextStylus
  },
  {}
);

export default function(schema: Schema) {
  return chain([
    setDefaultCollection('@nrwl/next'),
    addPackageWithInit('@nrwl/jest'),
    addPackageWithInit('@nrwl/cypress'),
    addPackageWithInit('@nrwl/web'),
    addPackageWithInit('@nrwl/react'),
    updateDependencies
  ]);
}
