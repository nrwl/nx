import {
  addDependenciesToPackageJson,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import {
  sassVersion,
  vitePluginVueVersion,
  vueRouterVersion,
  vueTestUtilsVersion,
  vueTscVersion,
} from './versions';

export type EnsureDependenciesOptions = {
  routing?: boolean;
  style?: 'scss' | 'none' | 'css';
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
  }

  return addDependenciesToPackageJson(tree, dependencies, devDependencies);
}
