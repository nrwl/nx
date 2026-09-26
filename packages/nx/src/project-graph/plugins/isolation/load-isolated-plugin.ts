import { PluginConfiguration } from '../../../config/nx-json';

import type { LoadedNxPlugin } from '../loaded-nx-plugin';

import { IsolatedPlugin } from './isolated-plugin';

const loadedPlugins: Map<string, Promise<IsolatedPlugin>> = (global[
  'nxLoadedPlugins'
] ??= new Map());

/**
 * Keys each loader last asked for; a sweep keeps their union. Global like
 * `loadedPlugins`, or one copy of Nx would sweep another's workers.
 */
const wantedBy: Map<string, Set<string>> = (global['nxWantedPlugins'] ??=
  new Map());

/**
 * Declares a loader's plugins and disposes any no loader wants. Call before loading.
 * Anything that makes a running worker unfit for reuse must be in its cache key.
 */
export function wantPlugins(
  loader: string,
  plugins: Array<{ plugin: PluginConfiguration; index?: number }>,
  root: string
): void {
  wantedBy.set(
    loader,
    new Set(
      plugins.map(({ plugin, index }) => getCacheKey(plugin, root, index))
    )
  );
  sweep();
}

export function disposeIsolatedPlugins(): void {
  wantedBy.clear();
  sweep();
}

export function loadIsolatedNxPlugin(
  plugin: PluginConfiguration,
  root: string,
  index?: number
): Promise<LoadedNxPlugin> {
  const cacheKey = getCacheKey(plugin, root, index);

  return (
    loadedPlugins.get(cacheKey) ??
    register(cacheKey, IsolatedPlugin.load(plugin, root, index))
  );
}

function register(
  cacheKey: string,
  loading: Promise<IsolatedPlugin>
): Promise<IsolatedPlugin> {
  const entry = loading.then(
    (plugin) => {
      // Swept while loading: nothing names it any more.
      if (!isWanted(cacheKey)) {
        plugin.dispose();
      }
      return plugin;
    },
    (err) => {
      forget(cacheKey, entry);
      throw err;
    }
  );

  if (isWanted(cacheKey)) {
    loadedPlugins.set(cacheKey, entry);
  }
  return entry;
}

function sweep(): void {
  for (const [cacheKey, entry] of [...loadedPlugins]) {
    if (isWanted(cacheKey)) {
      continue;
    }
    loadedPlugins.delete(cacheKey);
    entry.then(
      (plugin) => plugin.dispose(),
      // No worker to dispose; the caller reports the rejection.
      () => {}
    );
  }
}

function isWanted(cacheKey: string): boolean {
  for (const keys of wantedBy.values()) {
    if (keys.has(cacheKey)) {
      return true;
    }
  }
  return false;
}

/** Includes the index: a plugin carries its nx.json position, which exclusions and errors point at. */
function getCacheKey(
  plugin: PluginConfiguration,
  root: string,
  index?: number
): string {
  return JSON.stringify({ plugin, root, index });
}

function forget(cacheKey: string, entry: Promise<IsolatedPlugin>): void {
  if (loadedPlugins.get(cacheKey) === entry) {
    loadedPlugins.delete(cacheKey);
  }
}
