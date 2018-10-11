import { Rule, externalSchematic, chain } from '@angular-devkit/schematics';
import { updateJsonInTree } from '@nrwl/schematics/src/utils/ast-utils';

export default function(): Rule {
  return chain([
    updateJsonInTree('package.json', json => {
      json.devDependencies = json.devDependencies || {};
      json.devDependencies = {
        ...json.devDependencies,
        codelyzer: '~4.5.0'
      };

      return json;
    }),
    externalSchematic('@schematics/update', 'update', {
      packages: ['@angular/core'],
      from: '6.1.0',
      to: '7.0.0'
    }),
    externalSchematic('@schematics/update', 'update', {
      packages: ['@angular/cli'],
      from: '6.2.0',
      to: '7.0.1'
    })
  ]);
}
