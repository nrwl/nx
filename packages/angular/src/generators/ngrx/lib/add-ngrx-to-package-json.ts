import type { GeneratorCallback, Tree } from '@nrwl/devkit';
import { addDependenciesToPackageJson, readJson } from '@nrwl/devkit';
import { checkAndCleanWithSemver } from '@nrwl/workspace/src/utilities/version-utils';
import { gte } from 'semver';
import { getPkgVersionForAngularMajorVersion } from '../../../utils/version-utils';
import { rxjsVersion as defaultRxjsVersion } from '../../../utils/versions';
import { getInstalledAngularMajorVersion } from '../../utils/angular-version-utils';

export function addNgRxToPackageJson(tree: Tree): GeneratorCallback {
  let rxjsVersion: string;
  try {
    rxjsVersion = checkAndCleanWithSemver(
      'rxjs',
      readJson(tree, 'package.json').dependencies['rxjs']
    );
  } catch {
    rxjsVersion = checkAndCleanWithSemver('rxjs', defaultRxjsVersion);
  }
  const jasmineMarblesVersion = gte(rxjsVersion, '7.0.0') ? '~0.9.1' : '~0.8.3';

  const angularMajorVersion = getInstalledAngularMajorVersion(tree);
  const ngrxVersion = getPkgVersionForAngularMajorVersion(
    'ngrxVersion',
    angularMajorVersion
  );

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
