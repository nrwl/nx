import { Tree, readNxJson } from '@nx/devkit';

export function hasEslintPlugin(tree: Tree): boolean {
  const nxJson = readNxJson(tree);
  if (!nxJson) {
    throw new Error('Cannot find nx.json');
  }
  return (
    nxJson.plugins?.some((p) =>
      typeof p === 'string'
        ? p === '@nx/eslint/plugin'
        : p.plugin === '@nx/eslint/plugin'
    ) ?? false
  );
}
