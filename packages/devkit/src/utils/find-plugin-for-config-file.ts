import {
  type Tree,
  type PluginConfiguration,
  readNxJson,
  CreateNodesV2,
} from 'nx/src/devkit-exports';
import { findMatchingConfigFiles } from 'nx/src/devkit-internals';
import { minimatch } from 'minimatch';
export async function findPluginForConfigFile(
  tree: Tree,
  pluginName: string,
  pathToConfigFile: string
): Promise<PluginConfiguration> {
  const nxJson = readNxJson(tree);
  if (!nxJson.plugins) {
    return;
  }

  const pluginRegistrations: PluginConfiguration[] = nxJson.plugins.filter(
    (p) => (typeof p === 'string' ? p === pluginName : p.plugin === pluginName)
  );

  for (const plugin of pluginRegistrations) {
    if (typeof plugin === 'string') {
      return plugin;
    }

    if (!plugin.include && !plugin.exclude) {
      return plugin;
    }

    if (plugin.include || plugin.exclude) {
      const resolvedPlugin: {
        createNodes?: CreateNodesV2;
        createNodesV2?: CreateNodesV2;
      } = await import(pluginName);
      const pluginGlob =
        resolvedPlugin.createNodesV2?.[0] ?? resolvedPlugin.createNodes?.[0];
      // The file must be one this plugin actually processes (its path matches
      // the plugin's createNodes glob) before the registration's include/exclude
      // filters are applied.
      const matchingConfigFile =
        !pluginGlob || minimatch(pathToConfigFile, pluginGlob, { dot: true })
          ? findMatchingConfigFiles(
              [pathToConfigFile],
              plugin.include,
              plugin.exclude
            )
          : [];
      if (matchingConfigFile.length) {
        return plugin;
      }
    }
  }
}
