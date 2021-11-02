import type { GeneratorCallback, Tree } from '@nrwl/devkit';
import { addDependenciesToPackageJson } from '@nrwl/devkit';
import { ngrxVersion } from '../../../utils/versions';

export function addNgRxToPackageJson(tree: Tree): GeneratorCallback {
  return addDependenciesToPackageJson(
    tree,
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
