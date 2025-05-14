import { readNxJson, Tree } from '@nx/devkit';

export function hasPlugin(tree: Tree) {
  const nxJson = readNxJson(tree);
  return !!nxJson.plugins?.some((p) =>
    typeof p === 'string'
      ? p === '@nx/rspack/plugin'
      : p.plugin === '@nx/rspack/plugin'
  );
}
