import {
  addDependenciesToPackageJson,
  detectPackageManager,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { acknowledgeBuildScripts } from '@nx/devkit/internal';
import {
  oxcTransformVersion,
  swcCoreVersion,
  swcHelpersVersion,
} from '@nx/js/internal';
import { coreJsVersion, swcLoaderVersion, tsLibVersion } from './versions';

export type EnsureDependenciesOptions = {
  compiler?: 'babel' | 'swc' | 'tsc';
  useOxcDeclarations?: boolean;
};

export function ensureDependencies(
  tree: Tree,
  options: EnsureDependenciesOptions
): GeneratorCallback {
  const devDependencies: Record<string, string> = {};

  switch (options.compiler) {
    case 'swc':
      // @swc/core's postinstall only installs a wasm fallback for platforms not
      // covered by its prebuilt optional dependencies, so skip it.
      acknowledgeBuildScripts(tree, detectPackageManager(tree.root), {
        '@swc/core': false,
      });
      devDependencies['@swc/helpers'] = swcHelpersVersion;
      devDependencies['@swc/core'] = swcCoreVersion;
      devDependencies['swc-loader'] = swcLoaderVersion;
      break;
    case 'babel':
      devDependencies['core-js'] = coreJsVersion; // needed for preset-env to work
      devDependencies['tslib'] = tsLibVersion;
      break;
    default:
      devDependencies['tslib'] = tsLibVersion;
      break;
  }

  if (options.useOxcDeclarations) {
    devDependencies['oxc-transform'] = oxcTransformVersion;
  }

  return addDependenciesToPackageJson(
    tree,
    {},
    devDependencies,
    undefined,
    true
  );
}
