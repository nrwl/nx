import {
  type Tree,
  type PluginConfiguration,
  readNxJson,
  CreateNodes,
} from 'nx/src/devkit-exports';
import { matchPluginFiles } from 'nx/src/devkit-internals';

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
        createNodes?: CreateNodes;
        createNodesV2?: CreateNodes;
      } = await import(pluginName);
      const pluginGlob =
        resolvedPlugin.createNodes?.[0] ?? resolvedPlugin.createNodesV2?.[0];
      const matchingConfigFile = matchPluginFiles([pathToConfigFile], {
        pattern: pluginGlob,
        include: plugin.include,
        exclude: plugin.exclude,
      });
      if (matchingConfigFile.length) {
        return plugin;
      }
    }
  }
}
