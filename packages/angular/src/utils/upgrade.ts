import { Rule } from '@angular-devkit/schematics';
import { angularJsVersion } from './versions';
import { updateJsonInTree } from '@nrwl/workspace';

export function addUpgradeToPackageJson(): Rule {
  return updateJsonInTree('package.json', packageJson => {
    if (!packageJson['dependencies']) {
      packageJson['dependencies'] = {};
    }

    if (!packageJson['dependencies']['@angular/upgrade']) {
      packageJson['dependencies']['@angular/upgrade'] =
        packageJson['dependencies']['@angular/core'];
    }
    if (!packageJson['dependencies']['angular']) {
      packageJson['dependencies']['angular'] = angularJsVersion;
    }

    return packageJson;
  });
}
