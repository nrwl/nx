import { PluginConfiguration } from '../../../config/nx-json';

import type { PluginCapabilities } from '../capabilities-cache';
import type { LoadedNxPlugin } from '../loaded-nx-plugin';

import { IsolatedPlugin, type ResolvedPluginModule } from './isolated-plugin';

/**
 * The plugins this process has loaded, and the generation each belongs to.
 *
 * This map is the only thing that knows which workers exist, so it is also what
 * puts them down. A reload sweeps it and bumps the generation, which is what
 * covers a load still in flight: its plugins are stamped with the generation
 * their load started in, so one arriving after the sweep is disposed of rather
 * than joining the set that replaced it.
 */
type LoadedPlugin = {
  plugin: Promise<IsolatedPlugin>;
  readonly generation: number;
};

// Keyed separately from the older `isolatedPluginCache`: two copies of Nx in one
// process share this object, and they do not share this shape.
const loadedPlugins: Map<string, LoadedPlugin> = (global['nxLoadedPlugins'] ??=
  new Map());

let currentGeneration = 0;

/** The generation a load should stamp its plugins with. Read once, at its start. */
export function pluginGeneration(): number {
  return currentGeneration;
}

/**
 * Puts every loaded plugin down and starts a new generation, which is what a
 * reload does before it loads the next set.
 */
export function disposeIsolatedPlugins(): void {
  currentGeneration++;
  const loaded = [...loadedPlugins.values()];
  loadedPlugins.clear();
  for (const entry of loaded) {
    dispose(entry);
  }
}

export function loadIsolatedNxPlugin(
  plugin: PluginConfiguration,
  root: string,
  generation: number,
  index?: number,
  resolved?: ResolvedPluginModule
): Promise<LoadedNxPlugin> {
  const cacheKey = getCacheKey(plugin, root);

  const loaded = loadedPlugins.get(cacheKey);
  if (loaded) {
    return loaded.plugin;
  }

  return register(
    cacheKey,
    IsolatedPlugin.load(plugin, root, index, resolved),
    generation
  );
}

/**
 * Wires a plugin from capabilities another process recorded, leaving its worker
 * unspawned until a hook is called.
 */
export function useIsolatedNxPluginCapabilities(
  plugin: PluginConfiguration,
  root: string,
  generation: number,
  resolved: ResolvedPluginModule,
  capabilities: PluginCapabilities,
  index?: number,
  onLoaded?: (actual: PluginCapabilities, sourceFiles: string[] | null) => void
): Promise<LoadedNxPlugin> {
  const cacheKey = getCacheKey(plugin, root);

  const loaded = loadedPlugins.get(cacheKey);
  if (loaded) {
    return loaded.plugin;
  }

  return register(
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
    ),
    generation
  );
}

function register(
  cacheKey: string,
  loading: Promise<IsolatedPlugin>,
  generation: number
): Promise<IsolatedPlugin> {
  const entry: LoadedPlugin = {
    generation,
    plugin: loading.then(
      (plugin) => {
        // Swept while this was loading. The load that asked for it is the only
        // thing waiting on it, and that load's set has been replaced.
        if (generation !== currentGeneration) {
          plugin.dispose();
        }
        return plugin;
      },
      (err) => {
        // A failed load is not worth handing to the next caller, so the entry
        // goes and the next call retries.
        forget(cacheKey, generation);
        throw err;
      }
    ),
  };

  // Only the current set is reachable. Registering a superseded load's plugin
  // would hand it to the next caller as though it were current.
  if (generation === currentGeneration) {
    loadedPlugins.set(cacheKey, entry);
  }
  return entry.plugin;
}

function dispose(entry: LoadedPlugin): void {
  entry.plugin.then(
    (plugin) => plugin.dispose(),
    // A load that failed has no worker to dispose of, and its rejection is
    // already the caller's to report.
    () => {}
  );
}

function getCacheKey(plugin: PluginConfiguration, root: string): string {
  return JSON.stringify({ plugin, root });
}

/** Drops the entry, unless a later generation has already replaced it. */
function forget(cacheKey: string, generation: number): void {
  if (loadedPlugins.get(cacheKey)?.generation === generation) {
    loadedPlugins.delete(cacheKey);
  }
}
