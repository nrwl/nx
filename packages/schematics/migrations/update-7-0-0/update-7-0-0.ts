import { Rule, externalSchematic, chain } from '@angular-devkit/schematics';
import { updateJsonInTree } from '@nrwl/workspace';

export default function(): Rule {
  return chain([
    updateJsonInTree('package.json', json => {
      json.devDependencies = json.devDependencies || {};
      json.devDependencies = {
        ...json.devDependencies,
        codelyzer: '~4.5.0',
        'jasmine-marbles': '0.4.0'
      };

      if (json.devDependencies['ng-packagr']) {
        json.devDependencies['ng-packagr'] = '^4.2.0';
      }

      return json;
    }),
    externalSchematic('@schematics/update', 'update', {
      packages: ['@angular/core'],
      from: '6.1.0',
      to: '7.0.0',
      force: true
    }),
    externalSchematic('@schematics/update', 'update', {
      packages: ['@angular/cli'],
      from: '6.2.0',
      to: '7.0.1',
      force: true
    })
  ]);
}
