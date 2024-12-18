import { readNxJson, Tree } from '@nx/devkit';

export function hasRsbuildPlugin(tree: Tree) {
  const nxJson = readNxJson(tree);
  return !!nxJson.plugins?.some((p) =>
    typeof p === 'string'
      ? p === '@nx/rsbuild/plugin'
      : p.plugin === '@nx/rsbuild/plugin'
  );
}
