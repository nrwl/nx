import { updateJsonInTree, checkAndCleanWithSemver } from '@nrwl/workspace';
import { chain, SchematicContext } from '@angular-devkit/schematics';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';
import { gt } from 'semver';

const updateCLI = updateJsonInTree('package.json', json => {
  json.devDependencies = json.devDependencies || {};
  const cliVersion = json.devDependencies['@angular/cli'];
  const cleanCliVersion = checkAndCleanWithSemver('@angular/cli', cliVersion);

  if (cleanCliVersion && gt(cleanCliVersion, '8.1.1')) {
    return json;
  }

  if (json['devDependencies']['@angular/cli']) {
    json['devDependencies']['@angular/cli'] = '8.1.1';
  }

  if (json['devDependencies']['@angular-devkit/build-angular']) {
    json['devDependencies']['@angular-devkit/build-angular'] = '^0.801.1';
  }

  if (json['devDependencies']['@angular-devkit/build-ng-packagr']) {
    json['devDependencies']['@angular-devkit/build-ng-packagr'] = '~0.801.1';
  }

  return json;
});

const addInstall = (_: any, context: SchematicContext) => {
  context.addTask(new NodePackageInstallTask());
};

export default function() {
  return chain([updateCLI, addInstall]);
}
