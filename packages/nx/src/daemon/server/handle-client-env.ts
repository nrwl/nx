import { getPluginsIfLoadedOrLoading } from '../../project-graph/plugins/get-plugins';
import type { LoadedNxPlugin } from '../../project-graph/plugins/loaded-nx-plugin';
import { applyDaemonEnvFromClient } from '../client/daemon-environment';
import { serverLogger } from '../logger';
import {
  invalidateGraphCache,
  markInFlightRecomputationsStale,
} from './project-graph-incremental-recomputation';

/**
 * Applies an env-carrying client message to the daemon. Must be awaited
 * before dispatching the message's handler: plugin workers key their disk
 * caches on their own process env, so a graph request must not reach a worker
 * whose env still reflects the previous client.
 */
export async function handleClientEnv(
  env: Record<string, string>
): Promise<void> {
  const changedEnvKeys = applyDaemonEnvFromClient(env);
  if (changedEnvKeys.length === 0) {
    return;
  }
  serverLogger.log(
    `Graph recompute necessary due to env variable refresh. Changed keys: ${changedEnvKeys.join(
      ', '
    )}`
  );
  await forwardEnvToPluginWorkers(env);
  // Both discards are needed: clearing the cache makes the next request
  // recompute under the new env, and the generation bump chains any in-flight
  // compute (started under the old env) to that successor.
  invalidateGraphCache();
  markInFlightRecomputationsStale();
}

// Covers committed workers and an in-flight load, whose workers forked under
// the previous env before this apply and would otherwise keep it for good. A
// load started after this needs no forwarding: its workers fork with the
// daemon's already-updated process.env. Each forward settles rather than
// rejects so one dead worker (or a failed load) cannot fail every env-carrying
// client message.
async function forwardEnvToPluginWorkers(
  env: Record<string, string>
): Promise<void> {
  const pluginsPromise = getPluginsIfLoadedOrLoading();
  if (!pluginsPromise) {
    return;
  }
  let plugins: LoadedNxPlugin[];
  try {
    plugins = await pluginsPromise;
  } catch {
    // The load failed, so there are no workers to forward to.
    return;
  }
  await Promise.all(
    plugins.map((plugin) =>
      plugin.setWorkerEnv?.(env)?.catch((e) => {
        serverLogger.log(
          `Failed to forward env to plugin worker "${plugin.name}": ${e.message}`
        );
      })
    )
  );
}
