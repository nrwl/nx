import { workspaceRoot } from '../../../utils/workspace-root';
import { PluginConfiguration } from '../../../config/nx-json';
import { LoadedNxPlugin } from '../internal-api';
import { loadRemoteNxPlugin } from './plugin-pool';

/**
 * Used to ensure 1 plugin : 1 worker
 */
const remotePluginCache = new Map<
  string,
  readonly [Promise<LoadedNxPlugin>, () => void]
>();

export async function loadNxPluginInIsolation(
  plugin: PluginConfiguration,
  root = workspaceRoot
): Promise<readonly [Promise<LoadedNxPlugin>, () => void]> {
  const cacheKey = JSON.stringify(plugin);

  if (remotePluginCache.has(cacheKey)) {
    return remotePluginCache.get(cacheKey);
  }

  const [loadingPlugin, cleanup] = await loadRemoteNxPlugin(plugin, root);
  // We clean up plugin workers when Nx process completes.
  const val = [
    loadingPlugin,
    () => {
      cleanup();
      remotePluginCache.delete(cacheKey);
    },
  ] as const;
  remotePluginCache.set(cacheKey, val);
  return val;
}
