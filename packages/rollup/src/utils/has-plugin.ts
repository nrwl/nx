import { readNxJson, Tree } from '@nx/devkit';

export function hasPlugin(tree: Tree) {
  const nxJson = readNxJson(tree);
  return !!nxJson.plugins?.some((p) =>
    typeof p === 'string'
      ? p === '@nx/rollup/plugin'
      : p.plugin === '@nx/rollup/plugin'
  );
}
