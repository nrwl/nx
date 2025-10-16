import type { GeneratorCallback, Tree } from '@nx/devkit';
import { addDependenciesToPackageJson } from '@nx/devkit';
import { gte } from 'semver';
import { versions } from '../../utils/version-utils';
import { NormalizedNgRxRootStoreGeneratorOptions } from './normalize-options';

export function addNgRxToPackageJson(
  tree: Tree,
  options: NormalizedNgRxRootStoreGeneratorOptions
): GeneratorCallback {
  const jasmineMarblesVersion = gte(options.rxjsVersion, '7.0.0')
    ? '~0.9.1'
    : '~0.8.3';
  const ngrxVersion = versions(tree).ngrxVersion;

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
      ...(options.addDevTools
        ? { '@ngrx/store-devtools': ngrxVersion }
        : undefined),
      'jasmine-marbles': jasmineMarblesVersion,
    }
  );
}
