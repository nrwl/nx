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

/**
 * Stuff for specified NX Plugins.
 */
let currentPluginsConfigurationHash: string;
let loadedPlugins: LoadedNxPlugin[];
let pendingPluginsPromise:
  | Promise<readonly [LoadedNxPlugin[], () => void]>
  | undefined;
let cleanup: () => void | undefined;

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

  // Cleanup current plugins before loading new ones
  if (cleanup) {
    pendingPluginsPromise = undefined;
    cleanup();
  }

  pendingPluginsPromise ??= loadSpecifiedNxPlugins(pluginsConfiguration, root);

  currentPluginsConfigurationHash = pluginsConfigurationHash;
  const [[result, cleanupFn], defaultPlugins] = await Promise.all([
    pendingPluginsPromise,
    getOnlyDefaultPlugins(root),
  ]);
  cleanup = cleanupFn;
  loadedPlugins = result.concat(defaultPlugins);
  return loadedPlugins;
}

/**
 * Stuff for default NX Plugins.
 */

let loadedDefaultPlugins: LoadedNxPlugin[];
let cleanupDefaultPlugins: () => void;
let pendingDefaultPluginPromise:
  | Promise<readonly [LoadedNxPlugin[], () => void]>
  | undefined;

export async function getOnlyDefaultPlugins(root = workspaceRoot) {
  // If the plugins configuration has not changed, reuse the current plugins
  if (loadedDefaultPlugins) {
    return loadedPlugins;
  }

  // Cleanup current plugins before loading new ones
  if (cleanupDefaultPlugins) {
    pendingDefaultPluginPromise = undefined;
    cleanupDefaultPlugins();
  }

  pendingDefaultPluginPromise ??= loadDefaultNxPlugins(workspaceRoot);

  const [result, cleanupFn] = await pendingDefaultPluginPromise;
  cleanupDefaultPlugins = cleanupFn;
  loadedPlugins = result;
  return result;
}

export function cleanupPlugins() {
  pendingPluginsPromise = undefined;
  pendingDefaultPluginPromise = undefined;
  cleanup?.();
  cleanupDefaultPlugins?.();
}

/**
 * Stuff for generic loading
 */

function isIsolationEnabled() {
  // Explicitly enabled, regardless of further conditions
  if (process.env.NX_ISOLATE_PLUGINS === 'true') {
    return true;
  }
  if (
    // Explicitly disabled
    process.env.NX_ISOLATE_PLUGINS === 'false' ||
    // Isolation is disabled on WASM builds currently.
    IS_WASM
  ) {
    return false;
  }
  // Default value
  return true;
}

const loadingMethod = isIsolationEnabled()
  ? loadNxPluginInIsolation
  : loadNxPlugin;

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
  plugins: PluginConfiguration[],
  root = workspaceRoot
): Promise<readonly [LoadedNxPlugin[], () => void]> {
  performance.mark('loadSpecifiedNxPlugins:start');

  plugins ??= [];

  const cleanupFunctions: Array<() => void> = [];
  const ret = [
    await Promise.all(
      plugins.map(async (plugin) => {
        const pluginPath = typeof plugin === 'string' ? plugin : plugin.plugin;
        performance.mark(`Load Nx Plugin: ${pluginPath} - start`);

        const [loadedPluginPromise, cleanup] = await loadingMethod(
          plugin,
          root
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
  performance.mark('loadSpecifiedNxPlugins:end');
  performance.measure(
    'loadSpecifiedNxPlugins',
    'loadSpecifiedNxPlugins:start',
    'loadSpecifiedNxPlugins:end'
  );
  return ret;
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
