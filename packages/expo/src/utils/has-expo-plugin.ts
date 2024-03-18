import { readNxJson, Tree } from '@nx/devkit';

export function hasExpoPlugin(tree: Tree) {
  const nxJson = readNxJson(tree);
  return !!nxJson.plugins?.some((p) =>
    typeof p === 'string'
      ? p === '@nx/expo/plugin'
      : p.plugin === '@nx/expo/plugin'
  );
}
