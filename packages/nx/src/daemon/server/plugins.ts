import { hashObject } from '../../hasher/file-hasher';
import { readNxJson } from '../../config/nx-json';
import {
  LoadedNxPlugin,
  loadNxPlugins,
} from '../../project-graph/plugins/internal-api';
import { workspaceRoot } from '../../utils/workspace-root';

let currentPluginsConfigurationHash: string;
let loadedPlugins: LoadedNxPlugin[];
let cleanup: () => void;

export async function getPlugins() {
  const pluginsConfiguration = readNxJson().plugins ?? [];
  const pluginsConfigurationHash = hashObject(pluginsConfiguration);

  // If the plugins configuration has not changed, reuse the current plugins
  if (
    loadedPlugins &&
    pluginsConfigurationHash === currentPluginsConfigurationHash
  ) {
    return loadedPlugins;
  }

  // Cleanup current plugins before loading new ones
  if (cleanup) {
    cleanup();
  }

  currentPluginsConfigurationHash = pluginsConfigurationHash;
  const [result, cleanupFn] = await loadNxPlugins(
    pluginsConfiguration,
    workspaceRoot
  );
  cleanup = cleanupFn;
  loadedPlugins = result;
  return result;
}

export function cleanupPlugins() {
  cleanup();
}
