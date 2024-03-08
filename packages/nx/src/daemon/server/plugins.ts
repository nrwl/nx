import { readNxJson } from '../../config/nx-json';
import {
  RemotePlugin,
  loadNxPluginsInIsolation,
} from '../../project-graph/plugins/internal-api';
import { workspaceRoot } from '../../utils/workspace-root';

let loadedPlugins: Promise<RemotePlugin[]>;
let cleanup: () => void;

export async function getPlugins() {
  if (loadedPlugins) {
    return loadedPlugins;
  }
  const pluginsConfiguration = readNxJson().plugins ?? [];
  const [result, cleanupFn] = await loadNxPluginsInIsolation(
    pluginsConfiguration,
    workspaceRoot
  );
  cleanup = cleanupFn;
  return result;
}

export function cleanupPlugins() {
  cleanup();
}
