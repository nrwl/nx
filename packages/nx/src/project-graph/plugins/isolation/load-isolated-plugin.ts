import { PluginConfiguration } from '../../../config/nx-json';

import type { ObservedLoad, PluginCapabilities } from '../capabilities-cache';
import type { LoadedNxPlugin } from '../loaded-nx-plugin';

import { IsolatedPlugin, type ResolvedPluginModule } from './isolated-plugin';

/**
 * The plugins this process has loaded, keyed by the configuration that asked for
 * them. This map is the only thing that knows which workers exist, so it is also
 * what puts them down.
 */
// Keyed separately from the older `isolatedPluginCache`: two copies of Nx in one
// process share this object, and they do not share this shape.
const loadedPlugins: Map<string, Promise<IsolatedPlugin>> = (global[
  'nxLoadedPlugins'
] ??= new Map());

/**
 * The keys each loader last asked for.
 *
 * Kept per loader because the plugins nx.json names and the ones Nx configures
 * itself are loaded by separate callers, often at once, and neither knows the
 * other's half. What a sweep keeps is the union.
 */
const wantedBy = new Map<string, Set<string>>();

/**
 * Declares the plugins a loader wants and puts down everything no loader wants
 * any more.
 *
 * Called before loading, so a reload keeps the plugins the new configuration
 * still names, rather than tearing down a set it is about to ask for again. A
 * plugin registered after this, by a load that was superseded while it waited
 * for a lock, is disposed of on arrival for the same reason: nothing wants it.
 *
 * Keeping a plugin rests on its key describing its worker. Anything else that
 * would make a running worker the wrong one to reuse, such as the resolve
 * conditions it was spawned with, has to be part of that key.
 */
export function wantPlugins(
  loader: string,
  plugins: PluginConfiguration[],
  root: string
): void {
  wantedBy.set(
    loader,
    new Set(plugins.map((plugin) => getCacheKey(plugin, root)))
  );
  sweep();
}

/** Puts every loaded plugin down, whoever wanted it. */
export function disposeIsolatedPlugins(): void {
  wantedBy.clear();
  sweep();
}

export function loadIsolatedNxPlugin(
  plugin: PluginConfiguration,
  root: string,
  index?: number,
  resolved?: ResolvedPluginModule
): Promise<LoadedNxPlugin> {
  const cacheKey = getCacheKey(plugin, root);

  return (
    loadedPlugins.get(cacheKey) ??
    register(cacheKey, IsolatedPlugin.load(plugin, root, index, resolved))
  );
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
  onLoaded?: (actual: PluginCapabilities, observed: ObservedLoad) => void
): Promise<LoadedNxPlugin> {
  const cacheKey = getCacheKey(plugin, root);

  return (
    loadedPlugins.get(cacheKey) ??
    register(
      cacheKey,
      Promise.resolve(
        IsolatedPlugin.fromCapabilities(
          plugin,
          root,
          resolved,
          capabilities,
          index,
          onLoaded
        )
      )
    )
  );
}

function register(
  cacheKey: string,
  loading: Promise<IsolatedPlugin>
): Promise<IsolatedPlugin> {
  const entry = loading.then(
    (plugin) => {
      // Swept while this was loading, so the only thing waiting on it is the
      // load that asked for it, and no configuration names it any more.
      if (!isWanted(cacheKey)) {
        plugin.dispose();
      }
      return plugin;
    },
    (err) => {
      // A failed load is not worth handing to the next caller, so the entry
      // goes and the next call retries.
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
      // A load that failed has no worker to dispose of, and its rejection is
      // already the caller's to report.
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

function getCacheKey(plugin: PluginConfiguration, root: string): string {
  return JSON.stringify({ plugin, root });
}

/** Drops the entry, unless a later load has already replaced it. */
function forget(cacheKey: string, entry: Promise<IsolatedPlugin>): void {
  if (loadedPlugins.get(cacheKey) === entry) {
    loadedPlugins.delete(cacheKey);
  }
}
