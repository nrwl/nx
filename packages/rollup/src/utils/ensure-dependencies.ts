import {
  addDependenciesToPackageJson,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { swcCoreVersion, swcHelpersVersion } from '@nx/js/src/utils/versions';
import { swcLoaderVersion, tsLibVersion } from './versions';

export type EnsureDependenciesOptions = {
  compiler?: 'babel' | 'swc' | 'tsc';
};

export function ensureDependencies(
  tree: Tree,
  options: EnsureDependenciesOptions
): GeneratorCallback {
  if (options.compiler === 'swc') {
    return addDependenciesToPackageJson(
      tree,
      {},
      {
        '@swc/helpers': swcHelpersVersion,
        '@swc/core': swcCoreVersion,
        'swc-loader': swcLoaderVersion,
      }
    );
  }

  return addDependenciesToPackageJson(tree, {}, { tslib: tsLibVersion });
}
