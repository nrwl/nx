import { getPluginsIfLoadedOrLoading } from '../../project-graph/plugins/get-plugins';
import type { LoadedNxPlugin } from '../../project-graph/plugins/loaded-nx-plugin';
import { applyDaemonEnvFromClient } from '../client/daemon-environment';
import { serverLogger } from '../logger';
import { invalidateGraphCache } from './project-graph-incremental-recomputation';

// Bounds the wait for worker acknowledgements so a wedged worker cannot hold
// every env-carrying client message for the 10-minute plugin-hook timeout. A
// healthy worker applies the env synchronously and acks in milliseconds.
let envForwardTimeoutMs = 10_000;

// Test seam: the production timeout would stall the suite.
export function _setEnvForwardTimeoutMs(ms: number): void {
  envForwardTimeoutMs = ms;
}

let inFlightApply: Promise<void> | undefined;

/**
 * Applies an env-carrying client message to the daemon. Must be awaited
 * before dispatching the message's handler: plugin workers key their disk
 * caches on their own process env, so a graph request must not reach a worker
 * whose env still reflects the previous client.
 */
export async function handleClientEnv(
  env: Record<string, string>
): Promise<void> {
  // A client whose env matches one an in-flight apply already wrote to
  // process.env sees zero changed keys, yet the graph cache is only discarded
  // once that apply's forwarding completes. Wait for it so such a client
  // cannot be served the graph computed under the previous env.
  while (inFlightApply) {
    await inFlightApply;
  }
  const changedEnvKeys = applyDaemonEnvFromClient(env);
  if (changedEnvKeys.length === 0) {
    return;
  }
  serverLogger.log(
    `Graph recompute necessary due to env variable refresh. Changed keys: ${changedEnvKeys.join(
      ', '
    )}`
  );
  const apply = applyEnvChange(env);
  inFlightApply = apply;
  try {
    await apply;
  } finally {
    if (inFlightApply === apply) {
      inFlightApply = undefined;
    }
  }
}

async function applyEnvChange(env: Record<string, string>): Promise<void> {
  await forwardEnvToPluginWorkers(env);
  // Discarding the cached graph makes the next request recompute under the
  // new env, and chains any in-flight compute (started under the old env) to
  // that successor.
  invalidateGraphCache();
}

// Covers committed workers and an in-flight load, whose workers forked under
// the previous env before this apply and would otherwise keep it for good. A
// load started after this needs no forwarding: its workers fork with the
// daemon's already-updated process.env. Each forward settles rather than
// rejects so one dead worker (or a failed load) cannot fail every env-carrying
// client message. Timing out is safe: each worker socket delivers the already
// sent env update before any later graph message, and the plugin cache write
// guard drops a pass the update lands in the middle of.
async function forwardEnvToPluginWorkers(
  env: Record<string, string>
): Promise<void> {
  let timer: NodeJS.Timeout;
  const timedOut = await Promise.race([
    forwardEnvToPluginWorkersUnbounded(env).then(() => false),
    new Promise<true>((resolve) => {
      timer = setTimeout(() => resolve(true), envForwardTimeoutMs);
      timer.unref();
    }),
  ]).finally(() => clearTimeout(timer));
  if (timedOut) {
    serverLogger.log(
      `Timed out forwarding the new env to plugin workers after ${envForwardTimeoutMs}ms; continuing without their acknowledgement.`
    );
  }
}

async function forwardEnvToPluginWorkersUnbounded(
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
