import {
  addDependenciesToPackageJson,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
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
      devDependencies['@swc/helpers'] = swcHelpersVersion;
      devDependencies['@swc/core'] = swcCoreVersion;
      devDependencies['swc-loader'] = swcLoaderVersion;
      break;
    case 'babel':
      devDependencies['core-js'] = coreJsVersion;
      devDependencies['tslib'] = tsLibVersion;
      break;
    default:
      devDependencies['tslib'] = tsLibVersion;
      break;
  }

  if (options.useOxcDeclarations) {
    devDependencies['oxc-transform'] = oxcTransformVersion;
  }

  return addDependenciesToPackageJson(tree, {}, devDependencies);
}
