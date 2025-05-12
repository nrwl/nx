import { workspaceRoot } from '../../../utils/workspace-root';
import type { PluginConfiguration } from '../../../config/nx-json';
import type { LoadedNxPlugin } from '../loaded-nx-plugin';
import { loadRemoteNxPlugin } from './plugin-pool';

export async function loadNxPluginInIsolation(
  plugin: PluginConfiguration,
  root = workspaceRoot
): Promise<readonly [Promise<LoadedNxPlugin>, () => void]> {
  return loadRemoteNxPlugin(plugin, root);
}
