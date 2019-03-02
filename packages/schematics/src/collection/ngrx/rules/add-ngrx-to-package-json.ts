import { Rule } from '@angular-devkit/schematics';
import {
  ngrxVersion,
  ngrxStoreFreezeVersion,
  nxVersion
} from '../../../lib-versions';
import {
  addDepsToPackageJson,
  updateJsonInTree
} from '@nrwl/schematics/src/utils/ast-utils';

export function addNgRxToPackageJson(): Rule {
  return addDepsToPackageJson(
    {
      '@ngrx/store': ngrxVersion,
      '@ngrx/effects': ngrxVersion,
      '@ngrx/entity': ngrxVersion,
      '@ngrx/router-store': ngrxVersion,
      '@nrwl/nx': nxVersion
    },
    {
      '@ngrx/store-devtools': ngrxVersion,
      'ngrx-store-freeze': ngrxStoreFreezeVersion
    }
  );
}
