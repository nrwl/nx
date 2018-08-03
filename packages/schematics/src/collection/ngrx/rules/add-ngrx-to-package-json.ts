import { Rule } from '@angular-devkit/schematics';
import { ngrxVersion, ngrxStoreFreezeVersion } from '../../../lib-versions';
import { updateJsonInTree } from '@nrwl/schematics/src/utils/ast-utils';

export function addNgRxToPackageJson(): Rule {
  return updateJsonInTree('package.json', packageJson => {
    if (!packageJson['dependencies']) {
      packageJson['dependencies'] = {};
    }
    if (!packageJson['devDependencies']) {
      packageJson['devDependencies'] = {};
    }

    if (!packageJson['dependencies']['@ngrx/store']) {
      packageJson['dependencies']['@ngrx/store'] = ngrxVersion;
    }
    if (!packageJson['dependencies']['@ngrx/effects']) {
      packageJson['dependencies']['@ngrx/effects'] = ngrxVersion;
    }
    if (!packageJson['dependencies']['@ngrx/entity']) {
      packageJson['dependencies']['@ngrx/entity'] = ngrxVersion;
    }
    if (!packageJson['devDependencies']['@ngrx/store-devtools']) {
      packageJson['devDependencies']['@ngrx/store-devtools'] = ngrxVersion;
    }
    if (!packageJson['dependencies']['@ngrx/router-store']) {
      packageJson['dependencies']['@ngrx/router-store'] = ngrxVersion;
    }
    if (!packageJson['devDependencies']['ngrx-store-freeze']) {
      packageJson['devDependencies'][
        'ngrx-store-freeze'
      ] = ngrxStoreFreezeVersion;
    }

    return packageJson;
  });
}
