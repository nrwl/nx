import {
  type CachedPluginCapabilities,
  GraphPluginCapabilities,
  IS_WASM,
} from '../../native';
import { getLocalDbConnection } from '../../utils/db-connection';
import { logger } from '../../utils/logger';
import type { LoadedNxPlugin } from './loaded-nx-plugin';

/**
 * What a plugin registers, as far as a caller that never runs its hooks needs
 * to know: its `createNodes` pattern and which hooks exist.
 */
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
    // This checkout's own database: the rows describe the plugins that built
    // this checkout's graph, which another checkout at another commit may not
    // share.
    store ??= new GraphPluginCapabilities(getLocalDbConnection());
    return store;
  } catch (e) {
    logger.verbose('Could not open the graph plugin capabilities store', e);
    return null;
  }
}

/**
 * Records what the plugins that just built a graph register, against that
 * graph's `computedAt`.
 *
 * Called before the graph itself is written, so a graph on disk never lacks the
 * row that describes it.
 */
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

/**
 * The `computedAt` of a graph this process read from the cache rather than
 * built, so it has not loaded the plugins that built it.
 */
let computedAtOfGraphReadFromCache: number | undefined;

export function noteGraphReadFromCache(computedAt: number | undefined): void {
  computedAtOfGraphReadFromCache = computedAt;
}

/**
 * What the plugins that built the graph this process read from the cache
 * register, or null when this process built its own graph, read none, or the
 * recorded rows belong to another build.
 *
 * Null means "load them", never "none register anything".
 */
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
