import { Rule } from '@angular-devkit/schematics';
import { angularJsVersion } from './versions';
import { addDepsToPackageJson, readJsonInTree } from '@nrwl/workspace';

export function addUpgradeToPackageJson(): Rule {
  return (host, context) => {
    const packageJson = readJsonInTree(host, './package.json');
    const dependencies = {};

    if (!packageJson['dependencies']) {
      packageJson['dependencies'] = dependencies;
    }

    if (!packageJson['dependencies']['@angular/upgrade']) {
      dependencies['@angular/upgrade'] =
        packageJson['dependencies']['@angular/core'];
    }
    if (!packageJson['dependencies']['angular']) {
      dependencies['angular'] = angularJsVersion;
    }

    return addDepsToPackageJson(dependencies, {});
  };
}
