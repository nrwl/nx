import {
  mergeWith,
  SchematicContext,
  chain,
  url
} from '@angular-devkit/schematics';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';
import { addDepsToPackageJson, updateJsonInTree } from '../../utils/ast-utils';
import {
  jestVersion,
  nxVersion,
  jestPresetAngularVersion
} from '../../lib-versions';
import { Rule } from '@angular-devkit/schematics';

const updatePackageJson = addDepsToPackageJson(
  {},
  {
    '@nrwl/builders': nxVersion,
    jest: jestVersion,
    '@types/jest': jestVersion,
    'jest-preset-angular': jestPresetAngularVersion
  }
);

export default function(): Rule {
  return chain([mergeWith(url('./files')), updatePackageJson]);
}
