import { Tree, readNxJson } from '@nx/devkit';

const PLUGIN_NAME = '@nx/oxlint';

export function hasOxlintPlugin(tree: Tree): boolean {
  const nxJson = readNxJson(tree);
  return !!nxJson?.plugins?.some(
    (p) => (typeof p === 'string' ? p : p.plugin) === PLUGIN_NAME
  );
}
