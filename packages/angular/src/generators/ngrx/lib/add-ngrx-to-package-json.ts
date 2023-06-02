import type { GeneratorCallback, Tree } from '@nx/devkit';
import { addDependenciesToPackageJson } from '@nx/devkit';
import { gte } from 'semver';
import { versions } from '../../utils/version-utils';
import { NormalizedNgRxGeneratorOptions } from './normalize-options';

export function addNgRxToPackageJson(
  tree: Tree,
  options: NormalizedNgRxGeneratorOptions
): GeneratorCallback {
  const jasmineMarblesVersion = gte(options.rxjsVersion, '7.0.0')
    ? '~0.9.1'
    : '~0.8.3';
  const ngrxVersion = versions(tree).ngrxVersion;

  process.env.npm_config_legacy_peer_deps ??= 'true';

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
