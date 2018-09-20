import {
  mergeWith,
  SchematicContext,
  chain,
  url
} from '@angular-devkit/schematics';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';
import { updateJsonInTree } from '../../utils/ast-utils';
import {
  jestVersion,
  nxVersion,
  jestPresetAngularVersion
} from '../../lib-versions';
import { Rule } from '@angular-devkit/schematics';

const updatePackageJson = updateJsonInTree('package.json', json => {
  json.devDependencies = {
    ...json.devDependencies,
    '@nrwl/builders': nxVersion,
    jest: jestVersion,
    '@types/jest': jestVersion,
    'jest-preset-angular': jestPresetAngularVersion
  };
  return json;
});

function addInstall(_, context: SchematicContext) {
  context.addTask(new NodePackageInstallTask());
}

export default function(): Rule {
  return chain([mergeWith(url('./files')), updatePackageJson, addInstall]);
}
