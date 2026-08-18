import { readNxJson, Tree, updateNxJson } from '@nx/devkit';

const OLD_PATH = '@nx/dotnet/plugin';
const NEW_PATH = '@nx/dotnet';

/**
 * The `@nx/dotnet/plugin` subpath export has been removed in favor of the bare
 * `@nx/dotnet` specifier. This migration rewrites any `nx.json` plugin entries
 * that still register the plugin via the old `@nx/dotnet/plugin` path, updating
 * each entry in place so the order of the `plugins` array is preserved.
 */
export default function update(tree: Tree) {
  const nxJson = readNxJson(tree);
  if (!nxJson?.plugins?.length) {
    return;
  }

  let updated = false;
  for (let i = 0; i < nxJson.plugins.length; i++) {
    const plugin = nxJson.plugins[i];
    if (typeof plugin === 'string') {
      if (plugin === OLD_PATH) {
        nxJson.plugins[i] = NEW_PATH;
        updated = true;
      }
    } else if (plugin.plugin === OLD_PATH) {
      plugin.plugin = NEW_PATH;
      updated = true;
    }
  }

  if (updated) {
    updateNxJson(tree, nxJson);
  }
}
