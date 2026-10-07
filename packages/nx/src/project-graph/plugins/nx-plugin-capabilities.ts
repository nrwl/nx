import {
  type CachedPluginCapabilities,
  NxPluginCapabilities as NxPluginCapabilitiesStore,
  IS_WASM,
} from '../../native';
import { getLocalDbConnection } from '../../utils/db-connection';

export type NxPluginCapabilities = CachedPluginCapabilities;

let store: NxPluginCapabilitiesStore;

export function getNxPluginCapabilitiesStore(): NxPluginCapabilitiesStore | null {
  // The database is not part of the WASM build.
  if (IS_WASM) {
    return null;
  }
  // Checkout-local: the rows describe this checkout's graph.
  store ??= new NxPluginCapabilitiesStore(getLocalDbConnection());
  return store;
}

let computedAtOfGraphReadFromCache: number | undefined;

export function noteGraphReadFromCache(computedAt: number | undefined): void {
  computedAtOfGraphReadFromCache = computedAt;
}

/** Null means "load them", never "no plugin registers anything". */
export function capabilitiesOfNxPluginsReadFromCache():
  | NxPluginCapabilities[]
  | null {
  if (computedAtOfGraphReadFromCache === undefined) {
    return null;
  }
  return (
    getNxPluginCapabilitiesStore()?.get(computedAtOfGraphReadFromCache) ?? null
  );
}
