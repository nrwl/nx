import {
  addDependenciesToPackageJson,
  detectPackageManager,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { acknowledgeBuildScripts } from '@nx/devkit/internal';
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
    // sass pulls in @parcel/watcher, whose install script only builds from
    // source when npm_config_build_from_source is set.
    acknowledgeBuildScripts(tree, detectPackageManager(tree.root), {
      '@parcel/watcher': false,
    });
    devDependencies['sass'] = sassVersion;
  }

  return addDependenciesToPackageJson(
    tree,
    dependencies,
    devDependencies,
    undefined,
    true
  );
}
