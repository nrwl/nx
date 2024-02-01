import { readNxJson, Tree } from '@nx/devkit';

export function hasCypressPlugin(tree: Tree) {
  const nxJson = readNxJson(tree);
  return !!nxJson.plugins?.some((p) =>
    typeof p === 'string'
      ? p === '@nx/cypress/plugin'
      : p.plugin === '@nx/cypress/plugin'
  );
}
