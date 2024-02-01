import { PluginConfiguration, readNxJson, Tree } from '@nx/devkit';
import { join } from 'path';

export function hasVitePlugin(tree: Tree): boolean {
  const nxJson = readNxJson(tree);
  return !!nxJson.plugins?.some((p) =>
    typeof p === 'string'
      ? p === '@nx/vite/plugin'
      : p.plugin === '@nx/vite/plugin'
  );
}

export function viteServeName(tree: Tree): string {
  const nxJson = readNxJson(tree);
  const plugin: undefined | { plugin: string; options: any } =
    nxJson.plugins?.find(
      (p: PluginConfiguration) =>
        typeof p !== 'string' && p.plugin === '@nx/vite/plugin'
    ) as { plugin: string; options: any };

  return plugin?.options?.serveName ?? 'serve';
}

export function findViteConfig(
  tree: Tree,
  projectRootFullPath: string
): string {
  const allowsExt = ['js', 'mjs', 'ts', 'cjs', 'mts', 'cts'];

  for (const ext of allowsExt) {
    if (tree.exists(join(projectRootFullPath, `vite.config.${ext}`))) {
      return join(projectRootFullPath, `vite.config.${ext}`);
    }
  }
}
