import { chain, Rule } from '@angular-devkit/schematics';
import {
  addDepsToPackageJson,
  addPackageWithInit,
  formatFiles
} from '@nrwl/workspace';
import { removeDependency } from '@nrwl/workspace/src/utils/rules/npm-dependencies';
import {
  expressTypingsVersion,
  expressVersion,
  nxVersion
} from '../../utils/versions';
import { Schema } from './schema';
import { setDefaultCollection } from '@nrwl/workspace/src/utils/rules/workspace';

function addDependencies(): Rule {
  return addDepsToPackageJson(
    {
      express: expressVersion
    },
    {
      '@types/express': expressTypingsVersion,
      '@nrwl/express': nxVersion
    }
  );
}

export default function(schema: Schema) {
  return chain([
    setDefaultCollection('@nrwl/express'),
    addPackageWithInit('@nrwl/node'),
    addPackageWithInit('@nrwl/jest'),
    addDependencies(),
    removeDependency('@nrwl/express'),
    formatFiles(schema)
  ]);
}
