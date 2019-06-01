import { Rule, chain } from '@angular-devkit/schematics';

import { updateJsonInTree } from '../../src/utils/ast-utils';
import { addUpdateTask } from '../../src/utils/update-task';

const updateAngularCLI = addUpdateTask('@angular/cli', '7.2.2');

const updateTypescript = updateJsonInTree('package.json', json => {
  json.devDependencies = json.devDependencies || {};
  json.devDependencies = {
    ...json.devDependencies,
    typescript: '~3.2.2'
  };
  return json;
});

export default function(): Rule {
  return chain([updateTypescript, updateAngularCLI]);
}
