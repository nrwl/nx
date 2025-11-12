import { workspaceRoot } from '../../../utils/workspace-root.js';
import type { PluginConfiguration } from '../../../config/nx-json';
import type { LoadedNxPlugin } from '../loaded-nx-plugin';
import { loadRemoteNxPlugin } from './plugin-pool.js';

export async function loadNxPluginInIsolation(
  plugin: PluginConfiguration,
  root = workspaceRoot,
  index?: number
): Promise<readonly [Promise<LoadedNxPlugin>, () => void]> {
  return loadRemoteNxPlugin(plugin, root, index);
}
