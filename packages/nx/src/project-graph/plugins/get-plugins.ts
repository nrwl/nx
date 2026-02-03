import { join } from 'node:path';

import { shouldMergeAngularProjects } from '../../adapter/angular-json';
import { PluginConfiguration, readNxJson } from '../../config/nx-json';
import { hashObject } from '../../hasher/file-hasher';
import { IS_WASM } from '../../native';
import { workspaceRoot } from '../../utils/workspace-root';
import { loadNxPluginInIsolation } from './isolation';
import { loadNxPlugin } from './in-process-loader';

import type { LoadedNxPlugin } from './loaded-nx-plugin';
import {
  cleanupPluginTSTranspiler,
  pluginTranspilerIsRegistered,
} from './transpiler';
import { isIsolationEnabled } from './isolation/enabled';

/**
 * Stuff for specified NX Plugins.
 */
let currentPluginsConfigurationHash: string;
let loadedPlugins: LoadedNxPlugin[];
let pendingPluginsPromise: Promise<LoadedNxPlugin[]> | undefined;
let cleanupSpecifiedPlugins: () => void | undefined;

const loadingMethod = (
  plugin: PluginConfiguration,
  root: string,
  index?: number
) =>
  isIsolationEnabled()
    ? loadNxPluginInIsolation(plugin, root, index)
    : loadNxPlugin(plugin, root);

export async function getPlugins(
  root = workspaceRoot
): Promise<LoadedNxPlugin[]> {
  const pluginsConfiguration = readNxJson(root).plugins ?? [];
  const pluginsConfigurationHash = hashObject(pluginsConfiguration);

  // If the plugins configuration has not changed, reuse the current plugins
  if (
    loadedPlugins &&
    pluginsConfigurationHash === currentPluginsConfigurationHash
  ) {
    return loadedPlugins;
  }

  currentPluginsConfigurationHash = pluginsConfigurationHash;
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
      errors.push(
        result.reason instanceof Error
          ? result.reason
          : new Error(String(result.reason))
      );
    }
  }

  if (errors.length > 0) {
    throw new AggregateError(errors, errors.map((e) => e.message).join('\n'));
  }

  loadedPlugins = specifiedPlugins.concat(defaultPlugins);

  return loadedPlugins;
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
        error:
          result.reason instanceof Error
            ? result.reason
            : new Error(String(result.reason)),
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
      res.index = index;
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
        error:
          result.reason instanceof Error
            ? result.reason
            : new Error(String(result.reason)),
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
