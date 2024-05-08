import {
  addDependenciesToPackageJson,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { swcCoreVersion, swcHelpersVersion } from '@nx/js/src/utils/versions';
import { coreJsVersion, swcLoaderVersion, tsLibVersion } from './versions';

export type EnsureDependenciesOptions = {
  compiler?: 'babel' | 'swc' | 'tsc';
};

export function ensureDependencies(
  tree: Tree,
  options: EnsureDependenciesOptions
): GeneratorCallback {
  switch (options.compiler) {
    case 'swc':
      return addDependenciesToPackageJson(
        tree,
        {},
        {
          '@swc/helpers': swcHelpersVersion,
          '@swc/core': swcCoreVersion,
          'swc-loader': swcLoaderVersion,
        }
      );
    case 'babel':
      return addDependenciesToPackageJson(
        tree,
        {},
        {
          'core-js': coreJsVersion, // needed for preset-env to work
          tslib: tsLibVersion,
        }
      );
    default:
      return addDependenciesToPackageJson(tree, {}, { tslib: tsLibVersion });
  }
}
