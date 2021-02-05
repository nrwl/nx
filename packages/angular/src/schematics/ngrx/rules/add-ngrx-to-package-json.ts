import { Rule } from '@angular-devkit/schematics';
import { addDepsToPackageJson } from '@nrwl/workspace';
import { ngrxVersion } from '../../../utils/versions';

export function addNgRxToPackageJson(): Rule {
  return addDepsToPackageJson(
    {
      '@ngrx/store': ngrxVersion,
      '@ngrx/effects': ngrxVersion,
      '@ngrx/entity': ngrxVersion,
      '@ngrx/router-store': ngrxVersion,
      '@ngrx/component-store': ngrxVersion,
    },
    {
      '@ngrx/schematics': ngrxVersion,
      '@ngrx/store-devtools': ngrxVersion,
    }
  );
}
