import { join } from 'node:path';

import { shouldMergeAngularProjects } from '../../adapter/angular-json';
import {
  NxJsonConfiguration,
  PluginConfiguration,
  readNxJson,
} from '../../config/nx-json';
import { hashObject } from '../../hasher/file-hasher';
import { workspaceRoot } from '../../utils/workspace-root';
import { loadNxPlugin } from './in-process-loader';
import {
  disposeIsolatedPlugins,
  loadIsolatedNxPlugin,
  useIsolatedNxPluginCapabilities,
  wantPlugins,
} from './isolation';
import { resetResolvePluginCache } from './resolve-plugin';
import { canObserveModuleClosure } from './isolation/module-closure';
import {
  capabilitiesOfLoadedPlugin,
  computeCapabilityKey,
  createCapabilitiesLock,
  forgetCapabilities,
  hashSourceFiles,
  isCapabilityCacheEnabled,
  type PluginCapabilities,
  readValidRecords,
  recordCapabilities,
  storableSourceFiles,
  sameCapabilities,
  type ObservedLoad,
} from './capabilities-cache';
import type { PluginRecord } from '../../native';
import { isOnDaemon } from '../../daemon/is-on-daemon';
import { isDaemonEnabled } from '../../daemon/client/client';
import { serverLogger } from '../../daemon/logger';
import { DelayedSpinner } from '../../utils/delayed-spinner';
import { logger } from '../../utils/logger';
import { isLockWaitTimeout } from '../../utils/lock-wait';
import {
  IsolatedPlugin,
  resolveModule,
  type ResolvedPluginModule,
} from './isolation/isolated-plugin';

import { isIsolationEnabled } from './isolation/enabled';
import { isolationRefused, pluginWithoutWorker } from './isolation/fallback';

export { resetIsolationFallbackForTesting } from './isolation/fallback';
import { output } from '../../utils/output';
import { ProgressTopics } from '../../utils/progress-topics';
import type { LoadedNxPlugin } from './loaded-nx-plugin';
import {
  cleanupPluginTSTranspiler,
  pluginTranspilerIsRegistered,
} from './transpiler';

/**
 * Stuff for specified NX Plugins.
 */
let currentPluginsConfigurationHash: string;
let cachedSeparatedPlugins: SeparatedPlugins;
let pendingPluginsPromise: Promise<LoadedNxPlugin[]> | undefined;

/**
 * Drops what this module remembers about the specified plugins, so the next
 * call loads them again rather than reusing a set or a promise that describes
 * the previous configuration.
 *
 * The plugins themselves are not touched here. They are put down by the load
 * that follows, which says which ones it wants, and a plugin the new
 * configuration still names is kept rather than reloaded.
 */
function forgetSpecifiedPlugins(): void {
  if (pluginTranspilerIsRegistered()) {
    cleanupPluginTSTranspiler();
  }
  pendingPluginsPromise = undefined;
}

// In-flight separated-plugins load, tagged with its hash. Two roles: a
// concurrent caller for the same set shares this load instead of racing a
// second one, and it gates the cache commit — a load writes the cache only if
// it's still the registered load when it finishes, so a slow older load can't
// clobber a newer one's result (two recomputes can overlap).
let pendingSeparatedPlugins:
  | { hash: string; promise: Promise<SeparatedPlugins> }
  | undefined;

export interface SeparatedPlugins {
  specifiedPlugins: LoadedNxPlugin[];
  defaultPlugins: LoadedNxPlugin[];
}

export const loadingMethod = async (
  plugin: PluginConfiguration,
  root: string,
  index?: number,
  resolved?: ResolvedPluginModule
): Promise<LoadedNxPlugin> => {
  if (!isIsolationEnabled() || isolationRefused()) {
    return loadNxPlugin(plugin, root, index);
  }

  // Awaited here rather than handed on, because the worker failure surfaces on
  // this promise and the fallback has to happen before the caller sees it.
  try {
    return await loadIsolatedNxPlugin(plugin, root, index, resolved);
  } catch (e) {
    const inProcess = await pluginWithoutWorker(e, plugin, root, index);
    if (!inProcess) {
      throw e;
    }
    return inProcess;
  }
};

/**
 * Returns all plugins (specified + default) as a flat list.
 * Specified plugins come first, followed by default plugins.
 */
export async function getPlugins(
  nxJson: NxJsonConfiguration,
  root = workspaceRoot
): Promise<LoadedNxPlugin[]> {
  const { specifiedPlugins, defaultPlugins } = await getPluginsSeparated(
    nxJson,
    root
  );
  return specifiedPlugins.concat(defaultPlugins);
}

/**
 * Returns specified plugins (from nx.json) and default plugins (project.json,
 * package.json, etc.) as separate arrays. This separation is needed for
 * two-phase project configuration processing where target defaults are
 * applied between specified and default plugin results.
 *
 * `nxJson` is required so callers control the snapshot of nx.json the plugin
 * loader uses. This matters for the daemon's freshness-gated recompute, where
 * the snap hash and the plugin set must reflect the same disk state.
 */
export async function getPluginsSeparated(
  nxJson: NxJsonConfiguration,
  root = workspaceRoot
): Promise<SeparatedPlugins> {
  const pluginsConfiguration = nxJson.plugins ?? [];
  const pluginsConfigurationHash = hashObject(pluginsConfiguration);

  // If the plugins configuration has not changed, reuse the current plugins
  if (
    cachedSeparatedPlugins &&
    pluginsConfigurationHash === currentPluginsConfigurationHash
  ) {
    return cachedSeparatedPlugins;
  }

  // A concurrent call is already loading this exact plugin set — share its
  // load rather than starting a second one that would race the module-level
  // cache state below.
  if (pendingSeparatedPlugins?.hash === pluginsConfigurationHash) {
    return pendingSeparatedPlugins.promise;
  }

  // Plugins config changed (e.g. `nx add @nx/maven` updated nx.json). The
  // cached SeparatedPlugins is invalidated by the early-return above, but
  // pendingPluginsPromise, the in-flight load, would otherwise be reused by the
  // `??=` below and serve the previous plugin set forever. Forget it here; its
  // workers are put down by the sweep in the load below, which declares which
  // plugins it wants.
  forgetSpecifiedPlugins();

  const loadPromise = (async (): Promise<SeparatedPlugins> => {
    const results = await Promise.allSettled([
      getOnlyDefaultPlugins(root),
      (pendingPluginsPromise ??= loadSpecifiedNxPlugins(
        pluginsConfiguration,
        root
      )),
    ]);

    const errors: Error[] = [];
    const defaultPlugins: LoadedNxPlugin[] = [];
    const specifiedPlugins: LoadedNxPlugin[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled') {
        (i === 0 ? defaultPlugins : specifiedPlugins).push(...result.value);
      } else {
        errors.push(reasonToError(result.reason));
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(errors, errors.map((e) => e.message).join('\n'));
    }

    const separatedPlugins: SeparatedPlugins = {
      specifiedPlugins,
      defaultPlugins,
    };

    // Commit only if we're still the registered load — so the hash and the
    // cached set are always written together and describe the same plugins.
    if (pendingSeparatedPlugins?.promise === loadPromise) {
      cachedSeparatedPlugins = separatedPlugins;
      currentPluginsConfigurationHash = pluginsConfigurationHash;
    }

    return separatedPlugins;
  })();

  pendingSeparatedPlugins = {
    hash: pluginsConfigurationHash,
    promise: loadPromise,
  };

  try {
    return await loadPromise;
  } finally {
    // Clear the in-flight marker, but only if it still points at our load —
    // a newer call may have already replaced it.
    if (pendingSeparatedPlugins?.promise === loadPromise) {
      pendingSeparatedPlugins = undefined;
    }
  }
}

/**
 * Stuff for default NX Plugins.
 */

let loadedDefaultPlugins: LoadedNxPlugin[];
let loadedDefaultPluginsHash: string;
let pendingDefaultPluginPromise: Promise<LoadedNxPlugin[]> | undefined;

export async function getOnlyDefaultPlugins(root = workspaceRoot) {
  const hash = root;
  // If the plugins configuration has not changed, reuse the current plugins
  if (loadedDefaultPlugins && hash === loadedDefaultPluginsHash) {
    return loadedDefaultPlugins;
  }

  const loadPromise = (pendingDefaultPluginPromise ??=
    loadDefaultNxPlugins(workspaceRoot));
  const result = await loadPromise;

  // Commit only while this is still the registered load, so a set released while
  // it was loading is not handed back out as the current one.
  if (pendingDefaultPluginPromise === loadPromise) {
    loadedDefaultPlugins = result;
    loadedDefaultPluginsHash = hash;
  }
  return result;
}

/**
 * The plugins from an in-flight load (whose workers may already be forked) or
 * the last committed one, without triggering a load. Undefined when neither
 * exists or plugins were cleaned up. After a plugins-config change the
 * committed set can be the previous, already-disposed one until the new load
 * commits, so callers must tolerate a disposed worker.
 */
export function getPluginsIfLoadedOrLoading():
  | Promise<LoadedNxPlugin[]>
  | undefined {
  const separated = pendingSeparatedPlugins
    ? pendingSeparatedPlugins.promise
    : cachedSeparatedPlugins;
  if (!separated) {
    return undefined;
  }
  return Promise.resolve(separated).then(
    ({ specifiedPlugins, defaultPlugins }) =>
      specifiedPlugins.concat(defaultPlugins)
  );
}

export function cleanupPlugins() {
  forgetPeekedCapabilities();
  // Nothing this process queued is still wanted, and a turn that never came up
  // would otherwise hold every later caller behind a load nobody is waiting on.
  capabilityLoadQueue = Promise.resolve();
  disposeIsolatedPlugins();
  forgetSpecifiedPlugins();
  loadedDefaultPlugins = undefined;
  pendingDefaultPluginPromise = undefined;
  cachedSeparatedPlugins = undefined;
  // Drop the in-flight load too: clearing the marker flips its commit gate to
  // false, so a load resolving after teardown can't repopulate the torn-down cache.
  pendingSeparatedPlugins = undefined;
}

/**
 * Stuff for generic loading
 */

/**
 * How long a process waits for whichever process is loading the plugins before
 * loading them itself. Generous, because the holder is spawning a worker per
 * plugin, and bounded, because waiting forever turns one stuck process into a
 * stuck workspace.
 */
const MAX_WAIT_FOR_ANOTHER_PROCESS = 60_000;

interface PluginLoad {
  plugin: PluginConfiguration;
  index?: number;
  resolved?: ResolvedPluginModule;
  /** Null when the module's identity could not be established. */
  key: string | null;
  /** Set from a record, or from a load this process did to write one. */
  capabilities?: PluginCapabilities;
  /** Set once the plugin is loaded, or wired from a recorded capability set. */
  loaded?: Promise<LoadedNxPlugin>;
  error?: unknown;
}

function pluginLabel(plugin: PluginConfiguration): string {
  return typeof plugin === 'string' ? plugin : plugin.plugin;
}

/**
 * Records are only ever written by the isolated path, so a process running
 * plugins in its own process neither writes nor reads them. It has no worker to
 * skip, and loading a plugin there is a `require` rather than a spawn.
 */
function capabilityCacheApplies(): boolean {
  return (
    isIsolationEnabled() && !isolationRefused() && isCapabilityCacheEnabled()
  );
}

/**
 * Says which plugins this load wants before it starts, which is what puts down
 * the ones a previous load left that this configuration no longer names.
 */
async function loadPlugins(
  loader: string,
  pluginConfigurations: PluginConfiguration[],
  root: string,
  assignIndexes: boolean
): Promise<PromiseSettledResult<LoadedNxPlugin>[]> {
  const loads: PluginLoad[] = pluginConfigurations.map((plugin, index) => ({
    plugin,
    index: assignIndexes ? index : undefined,
    key: null,
  }));

  wantPlugins(loader, loads, root);

  // Gated synchronously: with no cache to consult, the loads must start in
  // this tick, as they did before the cache existed.
  if (loads.length && capabilityCacheApplies()) {
    await useCapabilityCache(loads, root);
  }

  return Promise.allSettled(
    loads.map(async (load) => {
      const label = pluginLabel(load.plugin);
      performance.mark(`Load Nx Plugin: ${label} - start`);

      if (load.error) {
        throw load.error;
      }

      load.loaded ??= loadingMethod(
        load.plugin,
        root,
        load.index,
        load.resolved
      );

      const res = await load.loaded;
      performance.mark(`Load Nx Plugin: ${label} - end`);
      performance.measure(
        `Load Nx Plugin: ${label}`,
        `Load Nx Plugin: ${label} - start`,
        `Load Nx Plugin: ${label} - end`
      );

      return res;
    })
  );
}

/**
 * Identifies each plugin's module. The resolution is kept on the load so that a
 * plugin this process goes on to load is not resolved a second time.
 */
async function resolveCapabilityKeys(
  loads: PluginLoad[],
  root: string,
  { withoutProjectWalk = false }: { withoutProjectWalk?: boolean } = {}
): Promise<void> {
  await Promise.all(
    loads.map(async (load) => {
      try {
        load.resolved = await resolveModule(load.plugin, root, {
          withoutProjectWalk,
        });
        load.key = computeCapabilityKey(
          pluginLabel(load.plugin),
          load.resolved.pluginPath,
          root
        );
      } catch (e) {
        // Left for the loader, which reports a resolution failure with the
        // plugin name and the context the caller expects.
        logger.verbose(
          `Could not resolve "${pluginLabel(load.plugin)}" ahead of loading it`,
          e
        );
        load.resolved = undefined;
        load.key = null;
      }
    })
  );
}

/**
 * One command asks the question up to three times, and each answer costs a
 * module resolution per plugin plus a closure hash for the workspace-local ones.
 * Held for processes that are not the daemon, which is the same lifetime
 * `getPluginsSeparated` already gives one plugin set, and excluded for the
 * daemon, which outlives the edits an answer depends on.
 *
 * This cannot be the thing that goes stale. Editing a plugin leaves its key
 * alone, but a fresh answer re-hashes the closure, misses, and falls through to
 * `getPlugins`, which hands back the set it loaded earlier in the process anyway.
 * `cleanupPlugins` drops both together for the same reason.
 *
 * Only a complete answer is held. A null one means some plugin has no record,
 * and the load that follows records it, so the next caller can do better.
 */
let peeked: { key: string; capabilities: PluginCapabilities[] } | undefined;

/**
 * Bumped whenever a record is corrected or dropped, and captured by a peek
 * before it reads anything.
 *
 * Clearing the memo is not enough on its own: a peek reads the records and only
 * assigns the memo several awaits later, so a correction landing in between
 * would be undone by the answer that predates it.
 */
let peekedGeneration = 0;

/** Drops the held answer, and any in-flight one that predates this call. */
function forgetPeekedCapabilities(): void {
  peeked = undefined;
  peekedGeneration++;
}

/**
 * What every plugin the workspace configures registers, or null when that
 * cannot be established.
 *
 * A plugin with a record is answered from it. What happens to the rest depends
 * on whether this process is the one that loads plugins at all. On the daemon,
 * or with no daemon, they are loaded, recorded and put back down, so a caller
 * that only needs to know whether a hook exists anywhere pays for the plugins
 * nothing knows about rather than for all of them. A client with a daemon loads
 * nothing and answers null instead, because the daemon it is about to ask is
 * where that load belongs; the records it reads are the ones the daemon wrote.
 */
export async function peekPluginCapabilities(
  nxJson: NxJsonConfiguration,
  root = workspaceRoot
): Promise<PluginCapabilities[] | null> {
  if (!capabilityCacheApplies()) {
    return null;
  }

  const memoKey = `${root}:${hashObject(nxJson.plugins ?? [])}`;
  if (!isOnDaemon() && peeked?.key === memoKey) {
    return peeked.capabilities;
  }
  const generation = peekedGeneration;

  const configurations = [
    ...(nxJson.plugins ?? []),
    ...getDefaultPlugins(root),
  ];
  const loads: PluginLoad[] = configurations.map((plugin) => ({
    plugin,
    key: null,
  }));

  // A client with a daemon answers from records or not at all. Loading here
  // would put the plugin set back in the process the records exist to keep it
  // out of, and the daemon is about to load them anyway; the same goes for the
  // workspace walk that resolving a local plugin needs, which is why the
  // resolution is asked for without it. Either shortfall reads as "cannot
  // tell", which is what the callers already do with null.
  const answersHere = isOnDaemon() || !isDaemonEnabled();

  await resolveCapabilityKeys(loads, root, {
    withoutProjectWalk: !answersHere,
  });

  // Nothing to key a record on, so there is no answer to complete and no point
  // loading anything here: the caller's own load reports the failure.
  if (loads.some((load) => !load.key)) {
    return null;
  }

  try {
    if (answersHere) {
      await loadWhatIsMissing(
        () => withRecordedCapabilities(loads, root),
        (missing) => loadForCapabilities(missing, root)
      );
    } else if (withRecordedCapabilities(loads, root).length) {
      return null;
    }
  } catch (e) {
    // Left to the caller's load, which reports a plugin failure with the name
    // and the context the caller expects.
    logger.verbose('Could not read every plugin capability set', e);
    return null;
  }

  const capabilities = loads.map((load) => load.capabilities);
  // Answered from records a correction has since replaced, so it is this
  // answer that is stale, not the memo it would overwrite.
  if (!isOnDaemon() && peekedGeneration === generation) {
    peeked = { key: memoKey, capabilities };
  }
  return capabilities;
}

/**
 * What every configured plugin registers, answered either way.
 *
 * `peekPluginCapabilities` says null when it cannot answer from records — no
 * record can be kept at all, or this is a client leaving the load to its daemon
 * — which a caller that needs the answer regardless would have to turn into a
 * load itself. This is that load, so the answer has one shape and the fallback
 * has one home.
 *
 * Not what the hook gates want. Those ask whether the records *prove* nothing
 * registers a hook, and the honest answer when there are no records is "cannot
 * tell", which lets the daemon load them on the side that was going to load
 * them anyway. Loading here to answer that would put the whole plugin set back
 * in the client, which is what the records exist to avoid.
 */
export async function capabilitiesOfConfiguredPlugins(
  nxJson: NxJsonConfiguration,
  root = workspaceRoot
): Promise<PluginCapabilities[]> {
  const recorded = await peekPluginCapabilities(nxJson, root);
  if (recorded) {
    return recorded;
  }

  return (await getPlugins(nxJson, root)).map(capabilitiesOfLoadedPlugin);
}

/**
 * Fills in the capabilities every load has a record for, and returns the rest.
 */
function withRecordedCapabilities(
  loads: PluginLoad[],
  root: string
): PluginLoad[] {
  const pending = loads.filter((load) => !load.capabilities);
  if (!pending.length) {
    return [];
  }

  const recorded = readValidRecords(
    pending.map((load) => load.key),
    root
  );
  const missing: PluginLoad[] = [];
  for (const load of pending) {
    const capabilities = recorded.get(load.key);
    if (capabilities) {
      load.capabilities = capabilities;
    } else {
      missing.push(load);
    }
  }
  return missing;
}

/**
 * Loads the plugins nothing has a record for, records what they register, and
 * puts them straight back down.
 *
 * Only those plugins, and only for as long as the answer takes: a caller here
 * wants to know what a plugin registers rather than to use it, so holding the
 * worker would charge it the load the records exist to avoid. A plugin the
 * command does go on to use is wired from the record this just wrote, and spawns
 * its worker when a hook is finally called.
 */
async function loadForCapabilities(
  loads: PluginLoad[],
  root: string
): Promise<void> {
  if (!loads.length) {
    return;
  }

  const entries = await Promise.all(
    loads.map(async (load) => {
      // Loaded outside the set this process keeps, so nothing else can be
      // holding it when it goes down again.
      const plugin = await IsolatedPlugin.load(
        load.plugin,
        root,
        undefined,
        load.resolved
      );
      try {
        load.capabilities = capabilitiesOfLoadedPlugin(plugin);
        return recordFor(
          load.key,
          load.capabilities,
          { sourceFiles: plugin.sourceFiles, envReads: plugin.envReads },
          root
        );
      } finally {
        plugin.dispose();
      }
    })
  );

  recordCapabilities(entries.filter((entry) => !!entry));
}

/**
 * Wires every plugin whose capabilities some process has already recorded, and
 * loads the rest while holding a lock, so that reading a given plugin's
 * capabilities never costs more than one process loading it.
 *
 * A plugin wired from a record has no worker until a hook is called, which is
 * what the callers that only read `createNodes[0]` or a `has*` flag rely on.
 */
async function useCapabilityCache(
  loads: PluginLoad[],
  root: string
): Promise<void> {
  await resolveCapabilityKeys(loads, root);

  const cacheable = loads.filter((load) => load.key);
  if (!cacheable.length) {
    return;
  }

  await loadWhatIsMissing(
    () => wireRecordedCapabilities(cacheable, root),
    (missing) => loadAndRecord(missing, root)
  );
}

/**
 * Serializes this process's own callers before any of them reaches the file
 * lock.
 *
 * A file lock is held by an open file description rather than by a process, so
 * the specified and default loaders, which run concurrently, would contend with
 * each other through two handles on one file: one would wait for the other and
 * be told a different process was loading. They still take their turns, as they
 * did through the lock, but the waiter neither opens the lock file nor spends
 * the budget meant for another process, and nobody is told to wait for a process
 * that does not exist.
 */
let capabilityLoadQueue: Promise<void> = Promise.resolve();

/**
 * Loads whatever `stillMissing` reports, with one process doing it rather than
 * all of them.
 *
 * The lock is around the load, and `stillMissing` is asked again each time
 * around: a waiter that gets in reads what the holder recorded while it waited,
 * and usually then has nothing left to load.
 */
function loadWhatIsMissing(
  stillMissing: () => PluginLoad[],
  load: (missing: PluginLoad[]) => Promise<void>
): Promise<void> {
  // Nothing missing, so nothing to queue behind: the common warm path neither
  // waits for another caller nor opens the lock file.
  if (!stillMissing().length) {
    return Promise.resolve();
  }

  const run = capabilityLoadQueue.then(
    () => loadWhatIsMissingExclusively(stillMissing, load),
    () => loadWhatIsMissingExclusively(stillMissing, load)
  );
  // The queue tracks completion rather than outcome, so one caller's failure
  // does not reject the next one's turn.
  capabilityLoadQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function loadWhatIsMissingExclusively(
  stillMissing: () => PluginLoad[],
  load: (missing: PluginLoad[]) => Promise<void>
): Promise<void> {
  const lock = createCapabilitiesLock();
  const deadline = Date.now() + MAX_WAIT_FOR_ANOTHER_PROCESS;
  let spinner: DelayedSpinner | undefined;
  try {
    while (true) {
      const missing = stillMissing();
      if (!missing.length) {
        return;
      }

      // One atomic step, rather than checking and then calling `lock`. That
      // call is synchronous, so a process that loses the race would block its
      // own event loop until the holder finished, which in the daemon means no
      // client is served and no signal is handled for the duration.
      const holdingLock = lock?.tryLock() ?? false;

      if (!holdingLock && lock) {
        const remaining = deadline - Date.now();
        if (remaining > 0) {
          spinner ??= new DelayedSpinner(
            'Waiting for another process to finish loading Nx plugins'
          );
          // Waited on the native async runtime, so neither the event loop nor
          // a libuv worker is held while it waits, and with a ceiling, so a
          // holder whose own loop is blocked cannot hold this process for as
          // long as it lives. The loop re-reads the records and re-checks the
          // budget either way.
          try {
            await lock.waitUntilFree(remaining);
          } catch (e) {
            // A timeout is the budget doing its job, and the check above ends
            // the wait on the next turn. The lock file itself failing is not
            // worth failing a load over either: this process goes on to load
            // what it needs, which is what it would have done with no cache.
            if (!isLockWaitTimeout(e)) {
              logger.verbose(
                'Could not wait on the plugin capabilities lock',
                e
              );
            }
          }
          continue;
        }

        // Out of budget, so the lock is left to whoever holds it and this
        // process loads anyway. That costs a second load of the same plugins,
        // which is what every process did before this cache existed, and the
        // record write is an upsert.
        logger.verbose(
          `Another process has held the plugin capabilities lock for over ${
            MAX_WAIT_FOR_ANOTHER_PROCESS / 1000
          }s. Loading plugins in this process as well.`
        );
      }

      try {
        // Read once more now the lock is held, since another process may have
        // recorded these between the read above and the acquire.
        await load(stillMissing());
      } finally {
        if (holdingLock) {
          lock.unlock();
        }
      }
      return;
    }
  } finally {
    spinner?.cleanup();
  }
}

/**
 * Wires the plugins that have a record and returns those that do not.
 */
function wireRecordedCapabilities(
  loads: PluginLoad[],
  root: string
): PluginLoad[] {
  const pending = loads.filter((load) => !load.loaded);
  if (!pending.length) {
    return [];
  }

  const recorded = readValidRecords(
    pending.map((load) => load.key),
    root
  );
  const missing: PluginLoad[] = [];
  for (const load of pending) {
    const capabilities = recorded.get(load.key);
    if (!capabilities) {
      missing.push(load);
      continue;
    }
    load.loaded = useIsolatedNxPluginCapabilities(
      load.plugin,
      root,
      load.resolved,
      capabilities,
      load.index,
      (actual, observed) =>
        repairRecord(load.key, root, capabilities, actual, observed)
    );
  }
  return missing;
}

/**
 * What the worker reported about the load it just did. Absent for an in-process
 * load, which this cache does not record.
 */
const observedLoads = new WeakMap<LoadedNxPlugin, ObservedLoad>();

export function noteObservedLoad(
  plugin: LoadedNxPlugin,
  observed: ObservedLoad
): void {
  observedLoads.set(plugin, observed);
}

async function loadAndRecord(loads: PluginLoad[], root: string): Promise<void> {
  if (!loads.length) {
    return;
  }

  const settled = await Promise.allSettled(
    loads.map(async (load) => {
      try {
        load.loaded = loadingMethod(
          load.plugin,
          root,
          load.index,
          load.resolved
        );
        // What the worker observed travels with the instance, so the record is
        // written from what actually ran rather than from a guess.
        const loaded = await load.loaded;
        const reported = loaded as Partial<ObservedLoad>;
        noteObservedLoad(loaded, {
          sourceFiles: reported.sourceFiles ?? null,
          envReads: reported.envReads ?? null,
        });
      } catch (e) {
        // Rethrown by the caller, so the failure reaches the same error
        // aggregation an uncached load would have reached.
        load.error = e;
        throw e;
      }
      return load.loaded;
    })
  );

  const entries: PluginCapabilitiesEntry[] = [];
  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    if (result.status !== 'fulfilled') {
      continue;
    }
    const entry = recordFor(
      loads[i].key,
      capabilitiesOfLoadedPlugin(result.value),
      observedLoads.get(result.value) ?? { sourceFiles: null, envReads: null },
      root
    );
    if (entry) {
      entries.push(entry);
    }
  }

  recordCapabilities(entries);
}

type PluginCapabilitiesEntry = { key: string; record: PluginRecord };

/**
 * The record to write for a plugin that has just loaded, or null when there is
 * nothing worth writing.
 *
 * A null closure means the runtime could not report one completely, and an
 * unstorable or unhashable one means a later read could not check it. A record
 * written from any of those could never be invalidated.
 */
function recordFor(
  key: string,
  capabilities: PluginCapabilities,
  observed: ObservedLoad,
  root: string
): PluginCapabilitiesEntry | null {
  if (observed.sourceFiles === null) {
    // Said out loud, because the alternative is a workspace where this cache
    // silently does nothing and no one can tell why. Which reason it is decides
    // what the reader should do about it, and only one of them is a Node
    // version: a plugin that fell back to this process was never observed at
    // all, whatever the runtime supports.
    const reason = !canObserveModuleClosure()
      ? 'Observing them needs Node 22.15, 23.5 or newer.'
      : 'It was loaded in this process rather than in a plugin worker, where nothing observes the load.';
    logger.verbose(
      `Nx could not observe which files "${capabilities.name}" read while loading, so its capabilities were not recorded. ${reason}`
    );
    return null;
  }

  if (observed.envReads === null) {
    // The load took the whole environment, so no list of variables describes
    // what it depends on and any record of it could be wrong on the next run.
    logger.verbose(
      `"${capabilities.name}" read its whole environment while loading, so its capabilities were not recorded.`
    );
    return null;
  }

  const sourceFiles = storableSourceFiles(observed.sourceFiles, root);
  if (sourceFiles === null) {
    return null;
  }
  const sourceHash = hashSourceFiles(sourceFiles, root);
  if (sourceHash === null) {
    return null;
  }

  return {
    key,
    record: {
      capabilities,
      sourceFiles,
      sourceHash,
      envReads: JSON.stringify(observed.envReads),
    },
  };
}

/**
 * A record the key failed to invalidate. The plugin's hooks were already wired
 * from it, so the fix is for the next run rather than this one.
 *
 * Warned rather than logged quietly, because this is the only moment anything
 * notices. A plugin whose record understates it has had a hook skipped
 * somewhere, and a run that says nothing about it leaves the user to find that
 * out from the consequence instead.
 */
function repairRecord(
  key: string,
  root: string,
  recorded: PluginCapabilities,
  actual: PluginCapabilities,
  observed: ObservedLoad
): void {
  if (sameCapabilities(recorded, actual)) {
    return;
  }

  // The memo was taken from the record this just proved wrong, and a later gate
  // in this same command would otherwise be answered from it rather than from
  // what the worker reported.
  forgetPeekedCapabilities();
  // Null is not none. An unobservable closure or environment coerced to an
  // empty one would write a record that `recordIsFresh` accepts without checking
  // anything, so nothing later could invalidate it, and a self-correcting hole
  // would become a permanent one.
  const corrected = recordFor(key, actual, observed, root);

  if (!corrected) {
    // Nothing to write in its place, so the wrong record goes. Thrown rather
    // than warned: a hook this record hid has already been skipped, so the
    // command's answer is wrong, and with the record gone the next run loads
    // the plugin and gets it right.
    forgetCapabilities(key);
    throw new Error(
      `Nx had stale information about what the "${actual.name}" plugin does, so some of its hooks may not have run. ` +
        'Nx could not tell what to watch for this plugin, so it could not record the right answer now. ' +
        'The stale record has been cleared, so running this command again will load the plugin and use what it reports.'
    );
  }

  recordCapabilities([corrected]);

  const title = `Nx had stale information about what the "${actual.name}" plugin does.`;
  const detail =
    'Its hooks may not have run in this command. The record has been corrected, so running the command again will use the right one.';

  // On the daemon, `output.warn` would reach the daemon's log and no terminal.
  // The graph-construction topic is how a plugin worker's lines get to whoever
  // is waiting on a graph, and this is the same kind of line.
  if (isOnDaemon()) {
    serverLogger.logToClient(
      ProgressTopics.GraphConstruction,
      `${title} ${detail}`,
      'warn'
    );
    return;
  }

  output.warn({
    title,
    bodyLines: [
      detail,
      'If you see this repeatedly, please report it at https://github.com/nrwl/nx/issues with the plugin name.',
    ],
  });
}

async function loadDefaultNxPlugins(
  root = workspaceRoot
): Promise<LoadedNxPlugin[]> {
  performance.mark('loadDefaultNxPlugins:start');

  const plugins = getDefaultPlugins(root);

  const results = await loadPlugins('default', plugins, root, false);

  const defaultPluginResults: LoadedNxPlugin[] = [];
  const errors: Array<{ pluginName: string; error: Error }> = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      defaultPluginResults.push(result.value);
    } else {
      errors.push({
        pluginName: plugins[i],
        error: reasonToError(result.reason),
      });
    }
  }

  if (errors.length > 0) {
    // Dropped so the next call retries rather than re-awaiting a promise that
    // is permanently rejected. What this load did manage to load is left
    // declared: the plugins are the same ones the retry will ask for.
    pendingDefaultPluginPromise = undefined;
    const errorMessage = errors
      .map((e) => `  - ${e.pluginName}: ${e.error.message}`)
      .join('\n');
    throw new AggregateError(
      errors.map((e) => e.error),
      `Failed to load ${errors.length} default Nx plugin(s):\n${errorMessage}`
    );
  }

  performance.mark('loadDefaultNxPlugins:end');
  performance.measure(
    'loadDefaultNxPlugins',
    'loadDefaultNxPlugins:start',
    'loadDefaultNxPlugins:end'
  );
  return defaultPluginResults;
}

async function loadSpecifiedNxPlugins(
  pluginsConfigurations: PluginConfiguration[],
  root = workspaceRoot
): Promise<LoadedNxPlugin[]> {
  performance.mark('loadSpecifiedNxPlugins:start');

  pluginsConfigurations ??= [];

  // Drop the cached workspace-layout snapshot local-plugin resolution uses:
  // in a long-lived daemon it can predate a newly added local plugin and
  // resolve it to the workspace root. Runs only when the plugin set changed.
  resetResolvePluginCache();

  const results = await loadPlugins(
    'specified',
    pluginsConfigurations,
    root,
    true
  );
  performance.mark('loadSpecifiedNxPlugins:end');
  performance.measure(
    'loadSpecifiedNxPlugins',
    'loadSpecifiedNxPlugins:start',
    'loadSpecifiedNxPlugins:end'
  );

  const plugins: LoadedNxPlugin[] = [];
  const errors: Array<{ pluginName: string; error: Error }> = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      plugins.push(result.value);
    } else {
      const pluginConfig = pluginsConfigurations[i];
      const pluginName =
        typeof pluginConfig === 'string' ? pluginConfig : pluginConfig.plugin;
      errors.push({
        pluginName,
        error: reasonToError(result.reason),
      });
    }
  }

  if (errors.length > 0) {
    // Nothing is retracted here. This load may have been superseded while it
    // ran, in which case the declaration is the newer load's and taking it back
    // would sweep the plugins that load is using. What this load did manage to
    // load stays declared until something declares otherwise, which is what the
    // next load through `getPluginsSeparated` does.
    const errorMessage = errors
      .map((e) => `  - ${e.pluginName}: ${e.error.message}`)
      .join('\n');
    throw new AggregateError(
      errors.map((e) => e.error),
      `Failed to load ${errors.length} Nx plugin(s):\n${errorMessage}`
    );
  }

  return plugins;
}

export function reasonToError(reason: unknown): Error {
  if (reason instanceof Error) {
    return reason;
  }
  if (typeof reason === 'object' && reason !== null && 'message' in reason) {
    const error = new Error(String(reason.message));
    if ('stack' in reason) {
      error.stack = String(reason.stack);
    }
    return error;
  }
  return new Error(String(reason));
}

function getDefaultPlugins(root: string) {
  return [
    join(__dirname, '../../plugins/js'),
    ...(shouldMergeAngularProjects(root, false)
      ? [join(__dirname, '../../adapter/angular-json')]
      : []),
    join(__dirname, '../../plugins/package-json'),
    join(__dirname, '../../plugins/project-json/build-nodes/project-json'),
  ];
}
