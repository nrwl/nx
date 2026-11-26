import { readNxJson, Tree } from '@nx/devkit';

export function hasRspackPlugin(tree: Tree) {
  const nxJson = readNxJson(tree);
  if (!nxJson) {
    throw new Error('Cannot find nx.json');
  }
  return !!nxJson.plugins?.some((p) =>
    typeof p === 'string'
      ? p === '@nx/rspack/plugin'
      : p.plugin === '@nx/rspack/plugin'
  );
}
