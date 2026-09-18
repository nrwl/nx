import {
  type CachedPluginCapabilities,
  GraphPluginCapabilities,
  IS_WASM,
} from '../../native';
import { getLocalDbConnection } from '../../utils/db-connection';
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

let store: GraphPluginCapabilities;

export function getGraphPluginCapabilitiesStore(): GraphPluginCapabilities | null {
  // The database is not part of the WASM build.
  if (IS_WASM) {
    return null;
  }
  // Checkout-local: the rows describe this checkout's graph.
  store ??= new GraphPluginCapabilities(getLocalDbConnection());
  return store;
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
  return (
    getGraphPluginCapabilitiesStore()?.get(computedAtOfGraphReadFromCache) ??
    null
  );
}
