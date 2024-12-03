import { workspaceRoot } from '../../../utils/workspace-root';
import { PluginConfiguration } from '../../../config/nx-json';
import { LoadedNxPlugin } from '../internal-api';
import { loadRemoteNxPlugin } from './plugin-pool';

export async function loadNxPluginInIsolation(
  plugin: PluginConfiguration,
  root = workspaceRoot
): Promise<readonly [Promise<LoadedNxPlugin>, () => void]> {
  const [loadingPlugin, cleanup] = await loadRemoteNxPlugin(plugin, root);
  return [
    loadingPlugin,
    () => {
      cleanup();
    },
  ] as const;
}
