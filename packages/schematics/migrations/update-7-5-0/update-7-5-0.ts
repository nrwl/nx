import { Rule, chain, externalSchematic } from '@angular-devkit/schematics';

import { updateJsonInTree } from '../../src/utils/ast-utils';

const updateAngularCLI = externalSchematic('@schematics/update', 'update', {
  packages: ['@angular/cli'],
  from: '7.1.0',
  to: '7.2.2',
  force: true
});

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
