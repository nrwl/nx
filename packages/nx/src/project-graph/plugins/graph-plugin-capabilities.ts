import {
  type CachedPluginCapabilities,
  GraphPluginCapabilities,
  IS_WASM,
} from '../../native';
import { getLocalDbConnection } from '../../utils/db-connection';
import { logger } from '../../utils/logger';
import type { LoadedNxPlugin } from './loaded-nx-plugin';

export type PluginCapabilities = CachedPluginCapabilities;

export function capabilitiesOfLoadedPlugin(
  plugin: LoadedNxPlugin
): PluginCapabilities {
  return {
    name: plugin.name,
    createNodesPattern: plugin.createNodes?.[0],
    hasCreateDependencies: !!plugin.createDependencies,
    hasCreateMetadata: !!plugin.createMetadata,
    hasPreTasksExecution: !!plugin.preTasksExecution,
    hasPostTasksExecution: !!plugin.postTasksExecution,
  };
}

let store: GraphPluginCapabilities | undefined;

function getStore(): GraphPluginCapabilities | null {
  // The database is not part of the WASM build.
  if (IS_WASM) {
    return null;
  }
  try {
    // Checkout-local: the rows describe this checkout's graph.
    store ??= new GraphPluginCapabilities(getLocalDbConnection());
    return store;
  } catch (e) {
    logger.verbose('Could not open the graph plugin capabilities store', e);
    return null;
  }
}

export function recordGraphPluginCapabilities(
  computedAt: number,
  plugins: LoadedNxPlugin[]
): void {
  try {
    getStore()?.record(computedAt, plugins.map(capabilitiesOfLoadedPlugin));
  } catch (e) {
    logger.verbose('Could not record graph plugin capabilities', e);
  }
}

let computedAtOfGraphReadFromCache: number | undefined;

export function noteGraphReadFromCache(computedAt: number | undefined): void {
  computedAtOfGraphReadFromCache = computedAt;
}

/** Null means "load them", never "no plugin registers anything". */
export function capabilitiesOfGraphReadFromCache():
  | PluginCapabilities[]
  | null {
  if (computedAtOfGraphReadFromCache === undefined) {
    return null;
  }
  try {
    return getStore()?.get(computedAtOfGraphReadFromCache) ?? null;
  } catch (e) {
    logger.verbose('Could not read graph plugin capabilities', e);
    return null;
  }
}
