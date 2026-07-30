import type { PluginConfiguration } from '../../config/nx-json';
import { LoadedNxPlugin } from './loaded-nx-plugin';
import type { NxPlugin } from './public-api';
import { handleImport } from '../../utils/handle-import';

export async function loadResolvedNxPluginAsync(
  pluginConfiguration: PluginConfiguration,
  pluginPath: string,
  name: string,
  index?: number
) {
  return bindPluginModule(
    await importPluginModule(pluginPath),
    pluginConfiguration,
    name,
    index
  );
}

/**
 * Binds an already-imported plugin module to its configuration.
 *
 * Split out of `loadResolvedNxPluginAsync` so the isolated plugin worker can
 * import the module eagerly — before the host has sent the configuration over
 * the socket — and bind it once that configuration arrives.
 */
export function bindPluginModule(
  module: NxPlugin,
  pluginConfiguration: PluginConfiguration,
  name: string,
  index?: number
) {
  // This needs to be spread to create an extensible object.
  const plugin = { ...module };
  plugin.name ??= name;
  return new LoadedNxPlugin(plugin, pluginConfiguration, index);
}

export async function importPluginModule(
  pluginPath: string
): Promise<NxPlugin> {
  const m = await handleImport(pluginPath);
  if (
    m.default &&
    ('createNodes' in m.default ||
      'createNodesV2' in m.default ||
      'createDependencies' in m.default ||
      'createMetadata' in m.default ||
      'preTasksExecution' in m.default ||
      'postTasksExecution' in m.default)
  ) {
    return m.default;
  }
  return m;
}
