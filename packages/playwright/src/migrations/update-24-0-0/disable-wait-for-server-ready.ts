import { formatFiles, readNxJson, type Tree, updateNxJson } from '@nx/devkit';

const pluginName = '@nx/playwright/plugin';

export default async function update(tree: Tree) {
  const nxJson = readNxJson(tree);
  if (!nxJson?.plugins) {
    return { skipAgentic: true };
  }

  let changed = false;
  nxJson.plugins = nxJson.plugins.map((plugin) => {
    if (typeof plugin === 'string') {
      if (plugin !== pluginName) {
        return plugin;
      }
      changed = true;
      return { plugin, options: { waitForServerReady: false } };
    }
    if (plugin.plugin !== pluginName) {
      return plugin;
    }
    const options = (plugin.options ?? {}) as Record<string, unknown>;
    if (options.waitForServerReady !== undefined) {
      return plugin;
    }
    changed = true;
    return { ...plugin, options: { ...options, waitForServerReady: false } };
  });

  if (!changed) {
    return { skipAgentic: true };
  }

  updateNxJson(tree, nxJson);
  await formatFiles(tree);
}
