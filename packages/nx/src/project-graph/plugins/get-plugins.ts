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
  wantPlugins,
} from './isolation';
import { resetResolvePluginCache } from './resolve-plugin';
import { isOnDaemon } from '../../daemon/is-on-daemon';
import { daemonClient, isDaemonEnabled } from '../../daemon/client/client';
import {
  capabilitiesOfGraphReadFromCache,
  capabilitiesOfLoadedPlugin,
  type PluginCapabilities,
} from './graph-plugin-capabilities';

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
let cachedSeparatedPlugins: SeparatedPlugins;
let pendingPluginsPromise: Promise<LoadedNxPlugin[]> | undefined;

/** Workers aren't disposed here; the next load's `wantPlugins` sweeps the ones it no longer names. */
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
  index?: number
): Promise<LoadedNxPlugin> => {
  if (!isIsolationEnabled() || isolationRefusedInThisProcess) {
    return loadNxPlugin(plugin, root, index);
  }

  // Awaited here rather than handed on, because the worker failure surfaces on
  // this promise and the fallback has to happen before the caller sees it.
  try {
    return await loadIsolatedNxPlugin(plugin, root, index);
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

  // Plugins config changed (e.g. `nx add @nx/maven`): drop the in-flight load,
  // or the `??=` below would serve the previous plugin set forever.
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

function pluginLabel(plugin: PluginConfiguration): string {
  return typeof plugin === 'string' ? plugin : plugin.plugin;
}

async function loadPlugins(
  loader: string,
  pluginConfigurations: PluginConfiguration[],
  root: string,
  assignIndexes: boolean
): Promise<PromiseSettledResult<LoadedNxPlugin>[]> {
  const loads = pluginConfigurations.map((plugin, index) => ({
    plugin,
    index: assignIndexes ? index : undefined,
  }));

  wantPlugins(loader, loads, root);

  return Promise.allSettled(
    loads.map(async ({ plugin, index }) => {
      const label = pluginLabel(plugin);
      performance.mark(`Load Nx Plugin: ${label} - start`);

      const res = await loadingMethod(plugin, root, index);
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

export async function capabilitiesOfConfiguredPlugins(
  nxJson: NxJsonConfiguration,
  root = workspaceRoot
): Promise<PluginCapabilities[]> {
  if (!isOnDaemon() && isDaemonEnabled()) {
    return daemonClient.getPluginCapabilities();
  }
  const recorded = capabilitiesOfGraphReadFromCache();
  if (recorded) {
    return recorded;
  }
  return (await getPlugins(nxJson, root)).map(capabilitiesOfLoadedPlugin);
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
    // Cleared so the next call retries instead of re-awaiting this rejection.
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
    // Wants are not retracted: a newer load may own the declaration by now.
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
