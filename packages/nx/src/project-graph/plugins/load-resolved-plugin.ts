import type { PluginConfiguration } from '../../config/nx-json';
import { LoadedNxPlugin } from './internal-api';
import { NxPlugin } from './public-api';

export async function loadResolvedNxPluginAsync(
  pluginConfiguration: PluginConfiguration,
  pluginPath: string,
  name: string
) {
  const plugin = await importPluginModule(pluginPath);
  plugin.name ??= name;
  return new LoadedNxPlugin(plugin, pluginConfiguration);
}

async function importPluginModule(pluginPath: string): Promise<NxPlugin> {
  const m = await import(pluginPath);
  if (
    m.default &&
    ('createNodes' in m.default ||
      'createNodesV2' in m.default ||
      'createDependencies' in m.default)
  ) {
    return m.default;
  }
  return m;
}
