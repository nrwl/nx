import { workspaceRoot } from '../../../utils/workspace-root';
import { PluginConfiguration } from '../../../config/nx-json';
import { LoadedNxPlugin } from '../internal-api';
import { loadRemoteNxPlugin } from './plugin-pool';

const remotePluginCache = new Map<
  string,
  [Promise<LoadedNxPlugin>, () => void]
>();

export function loadNxPluginInIsolation(
  plugin: PluginConfiguration,
  root = workspaceRoot
): [Promise<LoadedNxPlugin>, () => void] {
  const cacheKey = JSON.stringify(plugin);

  if (remotePluginCache.has(cacheKey)) {
    return remotePluginCache.get(cacheKey);
  }

  const [loadingPlugin, cleanup] = loadRemoteNxPlugin(plugin, root);
  remotePluginCache.set(cacheKey, [loadingPlugin, cleanup]);
  return [loadingPlugin, cleanup];
}
