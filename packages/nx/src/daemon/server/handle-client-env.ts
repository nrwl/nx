import type { EventEmitter } from 'node:events';
import { getPluginsIfLoadedOrLoading } from '../../project-graph/plugins/get-plugins';
import type { LoadedNxPlugin } from '../../project-graph/plugins/loaded-nx-plugin';
import {
  applyDaemonEnvFromClient,
  getAppliedDaemonClientEnv,
  getChangedEnvKeys,
  getLiveClientBerryEnv,
  hasBerryBinFolders,
  normalizeDaemonEnvironmentForGraph,
  setLiveClientBerryEnv,
  withoutBerryBinFolders,
  withoutBerryBinFoldersOnPath,
  withTrustedBerryBinFolders,
} from '../client/daemon-environment';
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
// Connected clients that carry Yarn Berry bin folders, by BERRY_BIN_FOLDER.
const liveBerryClients = new Map<EventEmitter, string | undefined>();
let workersHoldBerryFolders = false;

/**
 * Applies an env-carrying client message to the daemon. Must be awaited
 * before dispatching the message's handler: plugin workers key their disk
 * caches on their own process env, so a graph request must not reach a worker
 * whose env still reflects the previous client.
 */
export async function handleClientEnv(
  env: Record<string, string>,
  client?: EventEmitter
): Promise<void> {
  // A client whose env matches one an in-flight apply already wrote to
  // process.env sees zero changed keys, yet the graph cache is only discarded
  // once that apply's forwarding completes. Wait for it so such a client
  // cannot be served the graph computed under the previous env.
  while (inFlightApply) {
    await inFlightApply;
  }
  trackLiveClient(env, client);
  const keepBerryFolders = isBerryFolderLive(env);
  setLiveClientBerryEnv(keepBerryFolders ? env : undefined);
  // Yarn Berry's bin folders outlive neither the client nor its request, while
  // the daemon and anything it starts in the background do.
  const daemonEnv = withoutBerryBinFoldersOnPath(env);
  const graphEnvBefore = normalizeDaemonEnvironmentForGraph(process.env);
  const previousClientEnv = getAppliedDaemonClientEnv()?.env;
  const changedEnvKeys = applyDaemonEnvFromClient(daemonEnv);
  if (changedEnvKeys.length === 0) {
    // An unchanged env can still owe workers the folders a disconnect took.
    if (keepBerryFolders && !workersHoldBerryFolders) {
      await runApply(forwardEnvToPluginWorkers(workerEnv(env, true)));
    }
    return;
  }
  // Runtime changes always reach the workers, but only changes that survive
  // graph normalization (e.g. Yarn Berry's per-invocation BERRY_BIN_FOLDER
  // does not) invalidate the computed graph.
  const graphChangedKeys = new Set([
    ...getChangedEnvKeys(
      graphEnvBefore,
      normalizeDaemonEnvironmentForGraph(process.env)
    ),
    ...(previousClientEnv
      ? getChangedEnvKeys(
          normalizeDaemonEnvironmentForGraph(previousClientEnv),
          normalizeDaemonEnvironmentForGraph(daemonEnv)
        )
      : []),
  ]);
  if (graphChangedKeys.size > 0) {
    serverLogger.log(
      `Graph recompute necessary due to env variable refresh. Changed keys: ${[
        ...graphChangedKeys,
      ].join(', ')}`
    );
  } else {
    serverLogger.log(
      `Env variable refresh changed only runtime values (${changedEnvKeys.join(
        ', '
      )}); graph identity is unchanged, keeping the cached graph.`
    );
  }
  await runApply(
    applyEnvChange(workerEnv(env, keepBerryFolders), graphChangedKeys.size > 0)
  );
}

async function runApply(apply: Promise<void>): Promise<void> {
  inFlightApply = apply;
  try {
    await apply;
  } finally {
    if (inFlightApply === apply) {
      inFlightApply = undefined;
    }
  }
}

function trackLiveClient(
  env: Record<string, string>,
  client: EventEmitter | undefined
): void {
  if (!client || !hasBerryBinFolders(env) || liveBerryClients.has(client)) {
    return;
  }
  liveBerryClients.set(client, env.BERRY_BIN_FOLDER);
  client.once('close', () => {
    liveBerryClients.delete(client);
    if (!isBerryFolderLive(getLiveClientBerryEnv())) {
      setLiveClientBerryEnv(undefined);
    }
    dropUnownedBerryFolders().catch((e) => {
      serverLogger.log(
        `Failed to drop Yarn Berry bin folders from plugin workers: ${e.message}`
      );
    });
  });
}

function isBerryFolderLive(env: NodeJS.ProcessEnv): boolean {
  return (
    hasBerryBinFolders(env) &&
    [...liveBerryClients.values()].includes(env.BERRY_BIN_FOLDER)
  );
}

function workerEnv(
  env: Record<string, string>,
  keepBerryFolders: boolean
): Record<string, string> {
  workersHoldBerryFolders = keepBerryFolders;
  return (
    keepBerryFolders
      ? withTrustedBerryBinFolders(env)
      : withoutBerryBinFolders(env)
  ) as Record<string, string>;
}

/**
 * Once no connected client carries the applied env's bin folders, their Yarn
 * command is about to delete them, so plugin workers stop resolving through
 * them. A newer client's apply either lands after this forward or, if it ran
 * while this waited, has already forwarded its own env and is left in place.
 */
async function dropUnownedBerryFolders(): Promise<void> {
  while (inFlightApply) {
    await inFlightApply;
  }
  const appliedEnv = getAppliedDaemonClientEnv()?.env;
  if (
    !appliedEnv ||
    !workersHoldBerryFolders ||
    isBerryFolderLive(appliedEnv)
  ) {
    return;
  }
  setLiveClientBerryEnv(undefined);
  await runApply(forwardEnvToPluginWorkers(workerEnv(appliedEnv, false)));
}

async function applyEnvChange(
  env: Record<string, string>,
  invalidateGraph: boolean
): Promise<void> {
  await forwardEnvToPluginWorkers(env);
  if (!invalidateGraph) {
    return;
  }
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
