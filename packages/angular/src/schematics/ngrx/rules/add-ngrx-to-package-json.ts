import { Rule } from '@angular-devkit/schematics';
import { addDepsToPackageJson } from '@nrwl/schematics';
import {
  ngrxVersion,
  ngrxStoreFreezeVersion,
  nxVersion
} from '../../../utils/versions';

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
