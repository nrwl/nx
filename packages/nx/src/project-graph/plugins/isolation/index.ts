import { workspaceRoot } from '../../../utils/workspace-root';
import { PluginConfiguration } from '../../../config/nx-json';
import { LoadedNxPlugin } from '../internal-api';
import { loadRemoteNxPlugin } from './plugin-pool';

/**
 * Used to ensure 1 plugin : 1 worker
 */
const remotePluginCache = new Map<string, Promise<LoadedNxPlugin>>();

export function loadNxPluginInIsolation(
  plugin: PluginConfiguration,
  root = workspaceRoot
): [Promise<LoadedNxPlugin>, () => void] {
  const cacheKey = JSON.stringify(plugin);

  if (remotePluginCache.has(cacheKey)) {
    return [remotePluginCache.get(cacheKey), () => {}];
  }

  const loadingPlugin = loadRemoteNxPlugin(plugin, root);
  remotePluginCache.set(cacheKey, loadingPlugin);
  // We clean up plugin workers when Nx process completes.
  return [loadingPlugin, () => {}];
}
