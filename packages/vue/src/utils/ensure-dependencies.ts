import {
  addDependenciesToPackageJson,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import {
  lessVersion,
  sassVersion,
  vitePluginVueVersion,
  vueRouterVersion,
  vueTestUtilsVersion,
  vueTscVersion,
} from './versions.js';

export type EnsureDependenciesOptions = {
  routing?: boolean;
  style?: 'scss' | 'less' | 'none' | 'css';
};

export function ensureDependencies(
  tree: Tree,
  options: EnsureDependenciesOptions
): GeneratorCallback {
  const dependencies: Record<string, string> = {};
  const devDependencies: Record<string, string> = {
    '@vue/test-utils': vueTestUtilsVersion,
    '@vitejs/plugin-vue': vitePluginVueVersion,
    'vue-tsc': vueTscVersion,
  };

  if (options.routing) {
    dependencies['vue-router'] = vueRouterVersion;
  }

  if (options.style === 'scss') {
    devDependencies['sass'] = sassVersion;
  } else if (options.style === 'less') {
    devDependencies['less'] = lessVersion;
  }

  return addDependenciesToPackageJson(tree, dependencies, devDependencies);
}
