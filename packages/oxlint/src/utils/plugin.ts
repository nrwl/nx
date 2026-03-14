import { Tree, readNxJson } from '@nx/devkit';

export function hasOxlintPlugin(tree: Tree): boolean {
  const nxJson = readNxJson(tree);
  return nxJson.plugins?.some((p) =>
    typeof p === 'string'
      ? p === '@nx/oxlint/plugin'
      : p.plugin === '@nx/oxlint/plugin'
  );
}
