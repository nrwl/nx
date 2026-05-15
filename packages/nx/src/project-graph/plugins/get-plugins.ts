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
import { loadIsolatedNxPlugin } from './isolation';

import { isIsolationEnabled } from './isolation/enabled';
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
// In-flight `getPluginsSeparated` call paired with the plugin-config hash
// it's loading for. Lets a concurrent caller arriving with the same new
// config dedupe onto the existing load instead of either (a) hitting the
// cache check after `currentPluginsConfigurationHash` was bumped but
// before `cachedSeparatedPlugins` was replaced — that race served the
// previous load's stale result and surfaced as the spread.test.ts
// middle-plugin flake — or (b) racing a parallel reload that thrashes
// workers.
let pendingSeparatedPluginsLoad:
  | { hash: string; promise: Promise<SeparatedPlugins> }
  | undefined;

export interface SeparatedPlugins {
  specifiedPlugins: LoadedNxPlugin[];
  defaultPlugins: LoadedNxPlugin[];
}

const loadingMethod = (
  plugin: PluginConfiguration,
  root: string,
  index?: number
) =>
  isIsolationEnabled()
    ? loadIsolatedNxPlugin(plugin, root, index)
    : loadNxPlugin(plugin, root, index);

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

  // A load for this exact plugin set is already in flight (e.g. the
  // watcher kicked off a recompute and a `nx show` request landed
  // before it finished). Dedupe onto it instead of starting a parallel
  // reload that thrashes workers — and, more importantly, instead of
  // falling through to the cache check after a concurrent caller bumps
  // `currentPluginsConfigurationHash` to the new hash but hasn't yet
  // replaced `cachedSeparatedPlugins` (which was the spread.test.ts
  // middle-plugin flake).
  if (
    pendingSeparatedPluginsLoad &&
    pendingSeparatedPluginsLoad.hash === pluginsConfigurationHash
  ) {
    return pendingSeparatedPluginsLoad.promise;
  }

  // Plugins config changed (e.g. `nx add @nx/maven` updated nx.json). The
  // cached SeparatedPlugins is invalidated by the early-return above, but
  // pendingPluginsPromise — the in-flight load — would otherwise be reused
  // by the `??=` below and serve the previous plugin set forever. Tear
  // down the old workers and force a fresh load.
  cleanupSpecifiedPlugins?.();
  pendingPluginsPromise = undefined;

  const myHash = pluginsConfigurationHash;
  const myPromise = (async (): Promise<SeparatedPlugins> => {
    try {
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
        throw new AggregateError(
          errors,
          errors.map((e) => e.message).join('\n')
        );
      }

      const newCache: SeparatedPlugins = { specifiedPlugins, defaultPlugins };

      // Only commit the cache + hash if we're still the most recent
      // in-flight load. A newer config arrived during our load → that
      // newer load will commit its own (correct) result; we must not
      // overwrite it with our older one.
      if (pendingSeparatedPluginsLoad?.promise === myPromise) {
        cachedSeparatedPlugins = newCache;
        currentPluginsConfigurationHash = myHash;
        loadedPlugins = specifiedPlugins.concat(defaultPlugins);
      }

      return newCache;
    } finally {
      // Always drop the in-flight marker for our promise — on success
      // the cache is committed above, on error we want the next caller
      // to fall through and retry rather than be handed our rejection.
      if (pendingSeparatedPluginsLoad?.promise === myPromise) {
        pendingSeparatedPluginsLoad = undefined;
      }
    }
  })();

  pendingSeparatedPluginsLoad = { hash: myHash, promise: myPromise };
  return myPromise;
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

export function cleanupPlugins() {
  cleanupSpecifiedPlugins?.();
  cleanupDefaultPlugins?.();
  pendingPluginsPromise = undefined;
  pendingDefaultPluginPromise = undefined;
  cachedSeparatedPlugins = undefined;
}

/**
 * Stuff for generic loading
 */

async function loadDefaultNxPlugins(root = workspaceRoot) {
  performance.mark('loadDefaultNxPlugins:start');

  const plugins = getDefaultPlugins(root);

  const cleanupFunctions: Array<() => void> = [];
  const results = await Promise.allSettled(
    plugins.map(async (plugin) => {
      performance.mark(`Load Nx Plugin: ${plugin} - start`);

      const [loadedPluginPromise, cleanup] = await loadingMethod(plugin, root);

      cleanupFunctions.push(cleanup);
      const res = await loadedPluginPromise;
      performance.mark(`Load Nx Plugin: ${plugin} - end`);
      performance.measure(
        `Load Nx Plugin: ${plugin}`,
        `Load Nx Plugin: ${plugin} - start`,
        `Load Nx Plugin: ${plugin} - end`
      );

      return res;
    })
  );

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

  const cleanupFunctions: Array<() => void> = [];
  const results = await Promise.allSettled(
    pluginsConfigurations.map(async (plugin, index) => {
      const pluginPath = typeof plugin === 'string' ? plugin : plugin.plugin;
      performance.mark(`Load Nx Plugin: ${pluginPath} - start`);

      const [loadedPluginPromise, cleanup] = await loadingMethod(
        plugin,
        root,
        index
      );

      cleanupFunctions.push(cleanup);
      const res = await loadedPluginPromise;
      performance.mark(`Load Nx Plugin: ${pluginPath} - end`);
      performance.measure(
        `Load Nx Plugin: ${pluginPath}`,
        `Load Nx Plugin: ${pluginPath} - start`,
        `Load Nx Plugin: ${pluginPath} - end`
      );

      return res;
    })
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
