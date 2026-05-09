import {
  addDependenciesToPackageJson,
  detectPackageManager,
  getDependencyVersionFromPackageJson,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { coerce, major } from 'semver';
import {
  ajvVersion,
  vitePluginDtsVersion,
  vitePluginReactSwcVersion,
  vitePluginReactV4Version,
  vitePluginReactVersion,
} from './versions';

export type EnsureDependenciesOptions = {
  uiFramework: 'angular' | 'react' | 'none';
  compiler?: 'babel' | 'swc';
  includeLib?: boolean;
};

export function ensureDependencies(
  host: Tree,
  schema: EnsureDependenciesOptions
): GeneratorCallback {
  const devDependencies: Record<string, string> = {};

  if (schema.uiFramework === 'react') {
    if (schema.compiler === 'swc') {
      devDependencies['@vitejs/plugin-react-swc'] = vitePluginReactSwcVersion;
    } else {
      // @vitejs/plugin-react v6 requires Vite 8+, use v4 for older versions.
      // getDependencyVersionFromPackageJson resolves pnpm catalog: refs.
      const viteRange = getDependencyVersionFromPackageJson(host, 'vite');
      const coerced = viteRange ? coerce(viteRange) : null;
      const viteMajor = coerced ? major(coerced) : null;
      devDependencies['@vitejs/plugin-react'] =
        viteMajor !== null && viteMajor < 8
          ? vitePluginReactV4Version
          : vitePluginReactVersion;
    }
  }

  if (schema.includeLib) {
    devDependencies['vite-plugin-dts'] = vitePluginDtsVersion;
    if (detectPackageManager() !== 'pnpm') {
      devDependencies['ajv'] = ajvVersion;
    }
  }

  return addDependenciesToPackageJson(host, {}, devDependencies);
}
