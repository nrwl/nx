import { PluginConfiguration } from '../../../config/nx-json';

import type { LoadedNxPlugin } from '../loaded-nx-plugin';

import { IsolatedPlugin } from './isolated-plugin';

type IsolatedPluginCache = Map<string, Promise<IsolatedPlugin>>;

const isolatedPluginCache: IsolatedPluginCache = (global[
  'isolatedPluginCache'
] ??= new Map());

export async function loadIsolatedNxPlugin(
  plugin: PluginConfiguration,
  root: string,
  index?: number
): Promise<[Promise<LoadedNxPlugin>, () => void]> {
  const cacheKey = JSON.stringify({ plugin, root });

  if (isolatedPluginCache.has(cacheKey)) {
    return [isolatedPluginCache.get(cacheKey), () => {}];
  }

  const pluginPromise = IsolatedPlugin.load(plugin, root, index).catch(
    (err) => {
      // Remove failed entries from cache so subsequent calls can retry
      isolatedPluginCache.delete(cacheKey);
      throw err;
    }
  );

  isolatedPluginCache.set(cacheKey, pluginPromise);

  const cleanup = async () => {
    const instancePromise = isolatedPluginCache.get(cacheKey);
    isolatedPluginCache.delete(cacheKey);
    const instance = await instancePromise;
    instance?.shutdown();
  };

  return [pluginPromise, cleanup];
}
