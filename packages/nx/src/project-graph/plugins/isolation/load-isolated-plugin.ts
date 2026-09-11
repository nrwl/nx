import { PluginConfiguration } from '../../../config/nx-json';

import type { PluginCapabilities } from '../capabilities-cache';
import type { LoadedNxPlugin } from '../loaded-nx-plugin';

import { IsolatedPlugin, type ResolvedPluginModule } from './isolated-plugin';

/**
 * One plugin instance and the number of plugin sets using it.
 *
 * Counted rather than shared outright, because both directions are wrong. A
 * release that shut the worker down would kill one a set still loading is about
 * to use, and a second holder given nothing to release would leave the worker
 * running with no way to reach it.
 */
type HeldPlugin = {
  plugin: Promise<IsolatedPlugin>;
  holders: number;
};

// Keyed separately from the older `isolatedPluginCache`: two copies of Nx in one
// process share this object, and they do not share this shape.
const heldPlugins: Map<string, HeldPlugin> = (global['nxHeldPlugins'] ??=
  new Map());

export async function loadIsolatedNxPlugin(
  plugin: PluginConfiguration,
  root: string,
  index?: number,
  resolved?: ResolvedPluginModule
): Promise<[Promise<LoadedNxPlugin>, () => void]> {
  const cacheKey = getCacheKey(plugin, root);

  const held = heldPlugins.get(cacheKey);
  if (held) {
    return [held.plugin, holdOn(held, cacheKey)];
  }

  const entry: HeldPlugin = {
    plugin: IsolatedPlugin.load(plugin, root, index, resolved),
    holders: 0,
  };
  // A failed load is not worth handing to the next caller, so the entry goes and
  // the next call retries.
  entry.plugin = entry.plugin.catch((err) => {
    forget(cacheKey, entry);
    throw err;
  });
  heldPlugins.set(cacheKey, entry);

  return [entry.plugin, holdOn(entry, cacheKey)];
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

  const held = heldPlugins.get(cacheKey);
  if (held) {
    return [held.plugin, holdOn(held, cacheKey)] as const;
  }

  const instance = IsolatedPlugin.fromCapabilities(
    plugin,
    root,
    resolved,
    capabilities,
    index,
    onLoaded
  );
  const entry: HeldPlugin = { plugin: Promise.resolve(instance), holders: 0 };
  heldPlugins.set(cacheKey, entry);

  return [entry.plugin, holdOn(entry, cacheKey)] as const;
}

function getCacheKey(plugin: PluginConfiguration, root: string): string {
  return JSON.stringify({ plugin, root });
}

/**
 * Takes a hold for one plugin set and returns its release, which is idempotent
 * so a set can be released twice without taking a count that is not its own.
 */
function holdOn(entry: HeldPlugin, cacheKey: string): () => void {
  entry.holders++;
  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    entry.holders--;
    if (entry.holders > 0) {
      return;
    }
    forget(cacheKey, entry);
    entry.plugin.then(
      (instance) => instance.dispose(),
      // A load that failed has no worker to dispose of, and its rejection is
      // already the caller's to report.
      () => {}
    );
  };
}

/** Drops the entry, unless a later load has already replaced it. */
function forget(cacheKey: string, entry: HeldPlugin): void {
  if (heldPlugins.get(cacheKey) === entry) {
    heldPlugins.delete(cacheKey);
  }
}
