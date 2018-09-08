import {
  mergeWith,
  SchematicContext,
  chain,
  url
} from '@angular-devkit/schematics';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';
import { updateJsonInTree } from '../../utils/ast-utils';
import { jestVersion, nxVersion } from '../../lib-versions';
import { Rule } from '@angular-devkit/schematics';

const updatePackageJson = updateJsonInTree('package.json', json => {
  json.devDependencies = {
    ...json.devDependencies,
    '@nrwl/builders': nxVersion,
    jest: jestVersion,
    '@types/jest': jestVersion,
    'jest-preset-angular': '6.0.0'
  };
  return json;
});

function addInstall(_, context: SchematicContext) {
  context.addTask(new NodePackageInstallTask());
}

export default function(): Rule {
  return chain([mergeWith(url('./files')), updatePackageJson, addInstall]);
}
