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
  loadIsolatedNxPlugin,
  useIsolatedNxPluginCapabilities,
} from './isolation';
import { resetResolvePluginCache } from './resolve-plugin';
import {
  capabilitiesOfLoadedPlugin,
  computeCapabilityKey,
  createCapabilitiesLock,
  isCapabilityCacheEnabled,
  type PluginCapabilities,
  readCachedCapabilities,
  recordCapabilities,
  sameCapabilities,
} from './capabilities-cache';
import { isOnDaemon } from '../../daemon/is-on-daemon';
import { DelayedSpinner } from '../../utils/delayed-spinner';
import { logger } from '../../utils/logger';
import {
  resolveModule,
  type ResolvedPluginModule,
} from './isolation/isolated-plugin';

import { isIsolationEnabled } from './isolation/enabled';
import {
  isPluginWorkerSocketRefusal,
  isPluginWorkerStartupFailure,
} from './isolation/isolated-plugin';
import { sandboxSocketHint } from '../../daemon/sandbox-socket-hint';
import { isSandbox } from '../../utils/is-sandbox';
import { isAiAgent } from '../../native';
import { output } from '../../utils/output';
import type { LoadedNxPlugin } from './loaded-nx-plugin';
import {
  cleanupPluginTSTranspiler,
  pluginTranspilerIsRegistered,
} from './transpiler';

/**
 * Stuff for specified NX Plugins.
 */
let currentPluginsConfigurationHash: string;
let loadedPlugins: LoadedNxPlugin[];
let cachedSeparatedPlugins: SeparatedPlugins;
let pendingPluginsPromise: Promise<LoadedNxPlugin[]> | undefined;
let cleanupSpecifiedPlugins: () => void | undefined;

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

/**
 * Set once a worker has been refused in this process, and read by every later
 * plugin: nothing about a second attempt can succeed once the first has been
 * refused for a reason that belongs to the sandbox.
 *
 * It does not stop the spawns of the plugins already in flight. Callers load
 * plugins concurrently, so all of them are past the entry check before the
 * first worker dies; what the latch guarantees is that the advice is printed
 * once rather than once per plugin, and that anything loaded after the refusal
 * skips the worker entirely.
 *
 * Process-scoped rather than persisted: the refusal describes the environment
 * Nx is running in, so it must not follow the workspace into a plain terminal.
 */
let isolationRefusedInThisProcess = false;

/** Exported for tests: the fallback latch is process-scoped by design. */
export function resetIsolationFallbackForTesting() {
  isolationRefusedInThisProcess = false;
}

/**
 * Loads a plugin in a worker, falling back to this process when the worker's
 * socket was refused.
 *
 * Isolation is preferred: it is what keeps two plugins with conflicting
 * TypeScript versions or module-level state apart. But a sandbox that has not
 * been told about the Nx socket root refuses the worker's socket, and failing
 * the whole command over that is worse than running the plugins here. The
 * fallback is narrow on purpose. It needs a failure to start or reach the
 * worker, plus either a detectable sandbox or the worker's own EPERM/EACCES
 * exit code under an AI agent — the second arm is what covers an agent whose
 * sandbox sets no variable `isSandbox()` reads. A plugin that loaded and then
 * threw is rethrown, because rerunning it in-process would bury its actual
 * error.
 */
export const loadingMethod = async (
  plugin: PluginConfiguration,
  root: string,
  index?: number,
  resolved?: ResolvedPluginModule
): Promise<readonly [Promise<LoadedNxPlugin>, () => void]> => {
  if (!isIsolationEnabled() || isolationRefusedInThisProcess) {
    return loadNxPlugin(plugin, root, index);
  }

  const [isolatedPlugin, cleanup] = await loadIsolatedNxPlugin(
    plugin,
    root,
    index,
    resolved
  );

  // Awaited here rather than handed on, because the worker failure surfaces on
  // this promise and the fallback has to happen before the caller sees it.
  try {
    return [Promise.resolve(await isolatedPlugin), cleanup] as const;
  } catch (e) {
    // Proof, kept separate from policy. The errno the worker saw is what makes
    // the message certain; whether that errno is also grounds for degrading is a
    // different question, and conflating them made the warning assert a sandbox
    // for agents the hint itself declines to name.
    const provenRefusal = isPluginWorkerSocketRefusal(e);
    // An agent is required alongside the errno, so a refusal on an ordinary
    // workstation still surfaces rather than silently losing isolation.
    if (
      !isPluginWorkerStartupFailure(e) ||
      !((provenRefusal && isAiAgent()) || isSandbox())
    ) {
      throw e;
    }

    cleanup();

    // Read and set in one synchronous step. Concurrently loaded plugins each
    // arrive here with their own failure, so testing the latch after setting it
    // is what keeps the advice to one copy.
    const alreadyRefused = isolationRefusedInThisProcess;
    isolationRefusedInThisProcess = true;
    if (!alreadyRefused) {
      output.warn({
        // Names what Nx observed, not what it infers. `isAiAgent()` is broader
        // than the agents `sandboxSpecificRemedy` will name a setting for, so a
        // title asserting a sandbox could sit above a body that deliberately
        // does not.
        title: provenRefusal
          ? 'Nx was denied permission to create a plugin worker socket. Running plugins in the main process instead.'
          : 'Could not start a plugin worker. Running plugins in the main process instead.',
        bodyLines: [
          'Plugins that expect isolation may misbehave, and this is slower than a worker.',
          // `certain` on the errno alone. Reaching here via `isSandbox()` proves
          // only that a worker died before it connected, which denied permission
          // explains but so does an OOM kill or a broken install.
          ...sandboxSocketHint({ certain: provenRefusal }),
        ],
      });
    }

    return loadNxPlugin(plugin, root, index);
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
  // pendingPluginsPromise — the in-flight load — would otherwise be reused
  // by the `??=` below and serve the previous plugin set forever. Tear
  // down the old workers and force a fresh load.
  cleanupSpecifiedPlugins?.();
  pendingPluginsPromise = undefined;

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
      loadedPlugins = specifiedPlugins.concat(defaultPlugins);
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
let cleanupDefaultPlugins: () => void;
let pendingDefaultPluginPromise:
  | Promise<readonly [LoadedNxPlugin[], () => void]>
  | undefined;

export async function getOnlyDefaultPlugins(root = workspaceRoot) {
  const hash = root;
  // If the plugins configuration has not changed, reuse the current plugins
  if (loadedDefaultPlugins && hash === loadedDefaultPluginsHash) {
    return loadedDefaultPlugins;
  }

  // Cleanup current plugins before loading new ones
  if (cleanupDefaultPlugins) {
    cleanupDefaultPlugins();
  }

  pendingDefaultPluginPromise ??= loadDefaultNxPlugins(workspaceRoot);

  const [result, cleanupFn] = await pendingDefaultPluginPromise;

  cleanupDefaultPlugins = () => {
    loadedDefaultPlugins = undefined;
    pendingDefaultPluginPromise = undefined;
    cleanupFn();
  };

  loadedDefaultPlugins = result;
  loadedDefaultPluginsHash = hash;
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
  peeked = undefined;
  cleanupSpecifiedPlugins?.();
  cleanupDefaultPlugins?.();
  pendingPluginsPromise = undefined;
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
  /** Set once the plugin is loaded, or wired from a recorded capability set. */
  loaded?: readonly [Promise<LoadedNxPlugin>, () => void];
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
    isIsolationEnabled() &&
    !isolationRefusedInThisProcess &&
    isCapabilityCacheEnabled()
  );
}

async function loadPlugins(
  pluginConfigurations: PluginConfiguration[],
  root: string,
  assignIndexes: boolean
): Promise<{
  results: PromiseSettledResult<LoadedNxPlugin>[];
  cleanupFunctions: Array<() => void>;
}> {
  const loads: PluginLoad[] = pluginConfigurations.map((plugin, index) => ({
    plugin,
    index: assignIndexes ? index : undefined,
    key: null,
  }));

  // Gated synchronously: with no cache to consult, the loads must start in
  // this tick, as they did before the cache existed.
  if (loads.length && capabilityCacheApplies()) {
    await useCapabilityCache(loads, root);
  }

  const cleanupFunctions: Array<() => void> = [];
  const results = await Promise.allSettled(
    loads.map(async (load) => {
      const label = pluginLabel(load.plugin);
      performance.mark(`Load Nx Plugin: ${label} - start`);

      if (load.error) {
        throw load.error;
      }

      const [loadedPluginPromise, cleanup] =
        load.loaded ??
        (await loadingMethod(load.plugin, root, load.index, load.resolved));

      cleanupFunctions.push(cleanup);
      const res = await loadedPluginPromise;
      performance.mark(`Load Nx Plugin: ${label} - end`);
      performance.measure(
        `Load Nx Plugin: ${label}`,
        `Load Nx Plugin: ${label} - start`,
        `Load Nx Plugin: ${label} - end`
      );

      return res;
    })
  );

  return { results, cleanupFunctions };
}

/**
 * Wires every plugin whose capabilities some process has already recorded, and
 * loads the rest while holding a lock, so that reading a given plugin's
 * capabilities never costs more than one process loading it.
 *
 * A plugin wired from a record has no worker until a hook is called, which is
 * what the callers that only read `createNodes[0]` or a `has*` flag rely on.
 */
/**
 * Identifies each plugin's module. The resolution is kept on the load so that a
 * plugin this process goes on to load is not resolved a second time.
 */
async function resolveCapabilityKeys(
  loads: PluginLoad[],
  root: string
): Promise<void> {
  await Promise.all(
    loads.map(async (load) => {
      try {
        load.resolved = await resolveModule(load.plugin, root);
        load.key = await computeCapabilityKey(load.resolved.pluginPath, root);
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
 * What the records say about every plugin the workspace configures, or null
 * when any of them has no record. Null means the answer can only come from
 * loading them, which is what callers did before the records existed.
 *
 * Neither outcome loads a plugin or starts a worker, so a caller that only
 * needs to know whether a hook exists anywhere can ask before committing to a
 * load it may not need.
 */
/**
 * One command asks the question up to three times, and each answer costs a
 * module resolution per plugin plus a source hash for the workspace-local ones.
 * Held for processes that are not the daemon, which is the same lifetime
 * `getPluginsSeparated` already gives one plugin set, and excluded for the
 * daemon, which outlives the edits an answer depends on.
 *
 * Only a complete answer is held. A null one means some plugin has no record,
 * and the load that follows records it, so the next caller can do better.
 */
let peeked: { key: string; capabilities: PluginCapabilities[] } | undefined;

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

  const configurations = [
    ...(nxJson.plugins ?? []),
    ...getDefaultPlugins(root),
  ];
  const loads: PluginLoad[] = configurations.map((plugin) => ({
    plugin,
    key: null,
  }));
  await resolveCapabilityKeys(loads, root);

  if (loads.some((load) => !load.key)) {
    return null;
  }

  const recorded = readCachedCapabilities(loads.map((load) => load.key));
  // Two nx.json entries can name one module, so compare against the distinct
  // keys rather than the number of plugins.
  if (recorded.size !== new Set(loads.map((load) => load.key)).size) {
    return null;
  }

  const capabilities = loads.map((load) => recorded.get(load.key));
  if (!isOnDaemon()) {
    peeked = { key: memoKey, capabilities };
  }
  return capabilities;
}

async function useCapabilityCache(
  loads: PluginLoad[],
  root: string
): Promise<void> {
  await resolveCapabilityKeys(loads, root);

  const cacheable = loads.filter((load) => load.key);
  if (!cacheable.length) {
    return;
  }

  const lock = createCapabilitiesLock();
  const deadline = Date.now() + MAX_WAIT_FOR_ANOTHER_PROCESS;
  let spinner: DelayedSpinner | undefined;
  try {
    while (true) {
      const missing = wireRecordedCapabilities(cacheable, root);
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
          // Waited on a libuv thread with a ceiling, rather than through
          // `lock.wait()`, which settles only when the holder releases. A holder
          // whose own event loop is blocked never reaches its load timeout and
          // so never releases, and one unbounded wait is all it takes to hang
          // every other process in the workspace. The loop re-reads the records
          // and re-checks the budget either way.
          await lock.waitForRelease(remaining);
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
        await loadAndRecord(wireRecordedCapabilities(missing, root), root);
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

  const recorded = readCachedCapabilities(pending.map((load) => load.key));
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
      (actual) => repairRecord(load.key, capabilities, actual)
    );
  }
  return missing;
}

async function loadAndRecord(loads: PluginLoad[], root: string): Promise<void> {
  if (!loads.length) {
    return;
  }

  const settled = await Promise.allSettled(
    loads.map(async (load) => {
      try {
        load.loaded = await loadingMethod(
          load.plugin,
          root,
          load.index,
          load.resolved
        );
      } catch (e) {
        // Rethrown by the caller, so the failure reaches the same error
        // aggregation an uncached load would have reached.
        load.error = e;
        throw e;
      }
      return load.loaded[0];
    })
  );

  const entries: Array<{ key: string; capabilities: PluginCapabilities }> = [];
  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    if (result.status === 'fulfilled') {
      entries.push({
        key: loads[i].key,
        capabilities: capabilitiesOfLoadedPlugin(result.value),
      });
    }
  }

  recordCapabilities(entries);
}

/**
 * A record the key failed to invalidate. The plugin's hooks were already wired
 * from it, so the fix is for the next run rather than this one.
 */
function repairRecord(
  key: string,
  recorded: PluginCapabilities,
  actual: PluginCapabilities
): void {
  if (sameCapabilities(recorded, actual)) {
    return;
  }
  logger.verbose(
    `Cached capabilities for "${actual.name}" did not match the loaded plugin. Replacing the record.`
  );
  recordCapabilities([{ key, capabilities: actual }]);
}

async function loadDefaultNxPlugins(root = workspaceRoot) {
  performance.mark('loadDefaultNxPlugins:start');

  const plugins = getDefaultPlugins(root);

  const { results, cleanupFunctions } = await loadPlugins(plugins, root, false);

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
    for (const fn of cleanupFunctions) {
      fn();
    }
    const errorMessage = errors
      .map((e) => `  - ${e.pluginName}: ${e.error.message}`)
      .join('\n');
    throw new AggregateError(
      errors.map((e) => e.error),
      `Failed to load ${errors.length} default Nx plugin(s):\n${errorMessage}`
    );
  }

  const ret = [
    defaultPluginResults,
    () => {
      for (const fn of cleanupFunctions) {
        fn();
      }
      if (pluginTranspilerIsRegistered()) {
        cleanupPluginTSTranspiler();
      }
    },
  ] as const;
  performance.mark('loadDefaultNxPlugins:end');
  performance.measure(
    'loadDefaultNxPlugins',
    'loadDefaultNxPlugins:start',
    'loadDefaultNxPlugins:end'
  );
  return ret;
}

async function loadSpecifiedNxPlugins(
  pluginsConfigurations: PluginConfiguration[],
  root = workspaceRoot
): Promise<LoadedNxPlugin[]> {
  // Returning existing plugins is handled by getPlugins,
  // so, if we are here and there are existing plugins, they are stale
  if (cleanupSpecifiedPlugins) {
    cleanupSpecifiedPlugins();
  }

  performance.mark('loadSpecifiedNxPlugins:start');

  pluginsConfigurations ??= [];

  // Drop the cached workspace-layout snapshot local-plugin resolution uses:
  // in a long-lived daemon it can predate a newly added local plugin and
  // resolve it to the workspace root. Runs only when the plugin set changed.
  resetResolvePluginCache();

  const { results, cleanupFunctions } = await loadPlugins(
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
    for (const fn of cleanupFunctions) {
      fn();
    }
    const errorMessage = errors
      .map((e) => `  - ${e.pluginName}: ${e.error.message}`)
      .join('\n');
    throw new AggregateError(
      errors.map((e) => e.error),
      `Failed to load ${errors.length} Nx plugin(s):\n${errorMessage}`
    );
  }

  cleanupSpecifiedPlugins = () => {
    for (const fn of cleanupFunctions) {
      fn();
    }
    if (pluginTranspilerIsRegistered()) {
      cleanupPluginTSTranspiler();
    }
    pendingPluginsPromise = undefined;
  };

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
