import { Tree, readNxJson } from '@nx/devkit';

/** Both resolve to the same plugin; `@nx/oxlint` is what the generators write. */
const PLUGIN_NAMES = ['@nx/oxlint', '@nx/oxlint/plugin'];

export function hasOxlintPlugin(tree: Tree): boolean {
  const nxJson = readNxJson(tree);
  return !!nxJson?.plugins?.some((p) =>
    PLUGIN_NAMES.includes(typeof p === 'string' ? p : p.plugin)
  );
}
