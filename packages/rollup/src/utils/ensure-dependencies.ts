import {
  addDependenciesToPackageJson,
  detectPackageManager,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { acknowledgeBuildScripts } from '@nx/devkit/internal';
import { swcCoreVersion, swcHelpersVersion } from '@nx/js/internal';
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
      // @swc/core's postinstall only installs a wasm fallback for platforms not
      // covered by its prebuilt optional dependencies, so skip it.
      acknowledgeBuildScripts(tree, detectPackageManager(tree.root), {
        '@swc/core': false,
      });
      return addDependenciesToPackageJson(
        tree,
        {},
        {
          '@swc/helpers': swcHelpersVersion,
          '@swc/core': swcCoreVersion,
          'swc-loader': swcLoaderVersion,
        },
        undefined,
        true
      );
    case 'babel':
      return addDependenciesToPackageJson(
        tree,
        {},
        {
          'core-js': coreJsVersion, // needed for preset-env to work
          tslib: tsLibVersion,
        },
        undefined,
        true
      );
    default:
      return addDependenciesToPackageJson(
        tree,
        {},
        { tslib: tsLibVersion },
        undefined,
        true
      );
  }
}
