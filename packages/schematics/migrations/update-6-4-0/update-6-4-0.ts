import { Rule, SchematicContext, chain } from '@angular-devkit/schematics';
import { updateJsonInTree } from '../../src/utils/ast-utils';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';

function updateDependencies() {
  return updateJsonInTree('package.json', json => {
    json.dependencies = json.dependencies || {};
    json.dependencies = {
      ...json.dependencies,
      '@ngrx/effects': '6.1.0',
      '@ngrx/store': '6.1.0',
      '@ngrx/router-store': '6.1.0'
    };
    json.devDependencies = json.devDependencies || {};
    json.devDependencies = {
      ...json.devDependencies,
      '@angular/cli': '6.2.4',
      '@angular-devkit/build-angular': '~0.8.0',
      '@ngrx/store-devtools': '6.1.0',
      karma: '~3.0.0',
      'karma-coverage-istanbul-reporter': '~2.0.1',
      protractor: '~5.4.0',
      'ts-node': '~7.0.0',
      tslint: '~5.11.0',
      typescript: '~2.9.2'
    };

    if (json.devDependencies['@angular-devkit/build-ng-packagr']) {
      json.devDependencies['@angular-devkit/build-ng-packagr'] = '~0.8.0';
    }

    return json;
  });
}

const addInstall = (_, context: SchematicContext) => {
  context.addTask(new NodePackageInstallTask());
};

export default function(): Rule {
  return chain([updateDependencies(), addInstall]);
}
