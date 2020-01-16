import { chain, Rule } from '@angular-devkit/schematics';
import {
  addDepsToPackageJson,
  addPackageWithInit,
  formatFiles
} from '@nrwl/workspace';
import { removeDependency } from '@nrwl/workspace/src/utils/rules/npm-dependencies';
import { nxVersion } from '../../utils/versions';
import { Schema } from './schema';
import { setDefaultCollection } from '@nrwl/workspace/src/utils/rules/workspace';

function addDependencies(): Rule {
  return addDepsToPackageJson(
    {},
    {
      '@nrwl/node': nxVersion
    }
  );
}

export default function(schema: Schema) {
  return chain([
    setDefaultCollection('@nrwl/node'),
    addPackageWithInit('@nrwl/jest'),
    addDependencies(),
    removeDependency('@nrwl/node'),
    formatFiles(schema)
  ]);
}
