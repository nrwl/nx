import { PluginConfiguration } from '../../../config/nx-json';

import type { PluginCapabilities } from '../capabilities-cache';
import type { LoadedNxPlugin } from '../loaded-nx-plugin';

import { IsolatedPlugin, type ResolvedPluginModule } from './isolated-plugin';

type IsolatedPluginCache = Map<string, Promise<IsolatedPlugin>>;

const isolatedPluginCache: IsolatedPluginCache = (global[
  'isolatedPluginCache'
] ??= new Map());

export async function loadIsolatedNxPlugin(
  plugin: PluginConfiguration,
  root: string,
  index?: number,
  resolved?: ResolvedPluginModule
): Promise<[Promise<LoadedNxPlugin>, () => void]> {
  const cacheKey = getCacheKey(plugin, root);

  if (isolatedPluginCache.has(cacheKey)) {
    return [isolatedPluginCache.get(cacheKey), () => {}];
  }

  const pluginPromise = IsolatedPlugin.load(
    plugin,
    root,
    index,
    resolved
  ).catch((err) => {
    // Remove failed entries from cache so subsequent calls can retry
    isolatedPluginCache.delete(cacheKey);
    throw err;
  });

  isolatedPluginCache.set(cacheKey, pluginPromise);

  return [pluginPromise, cleanupFor(cacheKey)];
}

/**
 * Wires a plugin from capabilities another process recorded, leaving its worker
 * unspawned until a hook is called.
 */
export function useIsolatedNxPluginCapabilities(
  plugin: PluginConfiguration,
  root: string,
  resolved: ResolvedPluginModule,
  capabilities: PluginCapabilities,
  index?: number,
  onLoaded?: (actual: PluginCapabilities, sourceFiles: string[] | null) => void
): readonly [Promise<LoadedNxPlugin>, () => void] {
  const cacheKey = getCacheKey(plugin, root);

  const cached = isolatedPluginCache.get(cacheKey);
  if (cached) {
    return [cached, () => {}] as const;
  }

  const instance = IsolatedPlugin.fromCapabilities(
    plugin,
    root,
    resolved,
    capabilities,
    index,
    onLoaded
  );
  isolatedPluginCache.set(cacheKey, Promise.resolve(instance));

  return [Promise.resolve(instance), cleanupFor(cacheKey)] as const;
}

function getCacheKey(plugin: PluginConfiguration, root: string): string {
  return JSON.stringify({ plugin, root });
}

function cleanupFor(cacheKey: string): () => void {
  return async () => {
    const instancePromise = isolatedPluginCache.get(cacheKey);
    isolatedPluginCache.delete(cacheKey);
    const instance = await instancePromise;
    instance?.shutdown();
  };
}
