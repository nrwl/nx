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
  const [defaultPlugins, specifiedPlugins] = await Promise.all([
    getOnlyDefaultPlugins(root),
    (pendingPluginsPromise ??= loadSpecifiedNxPlugins(
      pluginsConfiguration,
      root
    )),
  ]);

  loadedPlugins = defaultPlugins.concat(specifiedPlugins);

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
  const ret = [
    await Promise.all(
      plugins.map(async (plugin) => {
        performance.mark(`Load Nx Plugin: ${plugin} - start`);

        const [loadedPluginPromise, cleanup] = await loadingMethod(
          plugin,
          root
        );

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
    ),
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
  const plugins = await Promise.all(
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
