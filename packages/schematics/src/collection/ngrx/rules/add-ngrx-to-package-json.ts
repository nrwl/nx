import { Rule } from '@angular-devkit/schematics';
import {
  ngrxVersion,
  routerStoreVersion,
  ngrxStoreFreezeVersion
} from '../../../lib-versions';
import { updateJsonInTree } from '@nrwl/schematics/src/utils/ast-utils';

export function addNgRxToPackageJson(): Rule {
  return updateJsonInTree('package.json', packageJson => {
    if (!packageJson['dependencies']) {
      packageJson['dependencies'] = {};
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
    if (!packageJson['dependencies']['@ngrx/store-devtools']) {
      packageJson['dependencies']['@ngrx/store-devtools'] = ngrxVersion;
    }
    if (!packageJson['dependencies']['@ngrx/router-store']) {
      packageJson['dependencies']['@ngrx/router-store'] = routerStoreVersion;
    }
    if (!packageJson['dependencies']['ngrx-store-freeze']) {
      packageJson['dependencies']['ngrx-store-freeze'] = ngrxStoreFreezeVersion;
    }

    return packageJson;
  });
}
