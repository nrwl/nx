import type { GeneratorCallback, Tree } from '@nrwl/devkit';
import { addDependenciesToPackageJson } from '@nrwl/devkit';
import { gte } from 'semver';
import {
  ngrxVersion,
  rxjsVersion as defaultRxjsVersion,
} from '../../../utils/versions';

export function addNgRxToPackageJson(tree: Tree): GeneratorCallback {
  let rxjsVersion: string;
  try {
    rxjsVersion = require('rxjs/package.json').version;
  } catch (e) {
    rxjsVersion = defaultRxjsVersion;
  }
  const jasmineMarblesVersion = gte(rxjsVersion, '7.0.0') ? '~0.9.1' : '~0.8.3';
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
      'jasmine-marbles': jasmineMarblesVersion,
    }
  );
}
