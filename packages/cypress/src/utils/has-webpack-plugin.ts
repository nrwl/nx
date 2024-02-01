import { PluginConfiguration, readNxJson, Tree } from '@nx/devkit';
import { join } from 'path';

export function hasWebpackPlugin(tree: Tree) {
  const nxJson = readNxJson(tree);
  return !!nxJson.plugins?.some((p) =>
    typeof p === 'string'
      ? p === '@nx/webpack/plugin'
      : p.plugin === '@nx/webpack/plugin'
  );
}

export function webpackServeName(tree: Tree): string {
  const nxJson = readNxJson(tree);
  const plugin: undefined | { plugin: string; options: any } =
    nxJson.plugins?.find(
      (p: PluginConfiguration) =>
        typeof p !== 'string' && p.plugin === '@nx/webpack/plugin'
    ) as { plugin: string; options: any };

  return plugin?.options?.serveName ?? 'serve';
}

export function findWebpackConfig(
  tree: Tree,
  projectRootFullPath: string
): string {
  const allowsExt = ['js', 'mjs', 'ts', 'cjs'];

  for (const ext of allowsExt) {
    if (tree.exists(join(projectRootFullPath, `webpack.config.${ext}`))) {
      return join(projectRootFullPath, `webpack.config.${ext}`);
    }
  }
}
