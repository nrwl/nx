import { readNxJson, Tree, updateNxJson } from '@nx/devkit';

const OLD_PATH = '@nx/dotnet/plugin';
const NEW_PATH = '@nx/dotnet';

/**
 * The `@nx/dotnet/plugin` subpath export has been removed in favor of the bare
 * `@nx/dotnet` specifier. This migration rewrites any `nx.json` plugin entries
 * that still register the plugin via the old `@nx/dotnet/plugin` path.
 */
export default function update(tree: Tree) {
  const nxJson = readNxJson(tree);
  if (!nxJson?.plugins?.length) {
    return;
  }

  const usesOldPath = nxJson.plugins.some((p) =>
    typeof p === 'string' ? p === OLD_PATH : p.plugin === OLD_PATH
  );
  if (!usesOldPath) {
    return;
  }

  const hasBarePlugin = nxJson.plugins.some((p) =>
    typeof p === 'string' ? p === NEW_PATH : p.plugin === NEW_PATH
  );

  nxJson.plugins = nxJson.plugins
    // If `@nx/dotnet` is already registered, drop the old-path entry instead of
    // registering the same plugin twice.
    .filter(
      (p) =>
        !(
          hasBarePlugin &&
          (typeof p === 'string' ? p === OLD_PATH : p.plugin === OLD_PATH)
        )
    )
    .map((p) => {
      if (typeof p === 'string') {
        return p === OLD_PATH ? NEW_PATH : p;
      }
      return p.plugin === OLD_PATH ? { ...p, plugin: NEW_PATH } : p;
    });

  updateNxJson(tree, nxJson);
}
