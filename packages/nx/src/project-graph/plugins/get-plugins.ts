import { hashObject } from '../../hasher/file-hasher';
import { readNxJson } from '../../config/nx-json';
import {
  loadDefaultNxPlugins,
  LoadedNxPlugin,
  loadSpecifiedNxPlugins,
} from './internal-api';
import { workspaceRoot } from '../../utils/workspace-root';

let currentPluginsConfigurationHash: string;
let loadedPlugins: LoadedNxPlugin[];
let pendingPluginsPromise:
  | Promise<readonly [LoadedNxPlugin[], () => void]>
  | undefined;
let cleanup: () => void;

export async function getPlugins(): Promise<LoadedNxPlugin[]> {
  const pluginsConfiguration = readNxJson().plugins ?? [];
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

  pendingPluginsPromise ??= loadSpecifiedNxPlugins(
    pluginsConfiguration,
    workspaceRoot
  );

  currentPluginsConfigurationHash = pluginsConfigurationHash;
  const [[result, cleanupFn], defaultPlugins] = await Promise.all([
    pendingPluginsPromise,
    getOnlyDefaultPlugins(),
  ]);
  cleanup = cleanupFn;
  loadedPlugins = result.concat(defaultPlugins);
  return loadedPlugins;
}

let loadedDefaultPlugins: LoadedNxPlugin[];
let cleanupDefaultPlugins: () => void;
let pendingDefaultPluginPromise:
  | Promise<readonly [LoadedNxPlugin[], () => void]>
  | undefined;

export async function getOnlyDefaultPlugins() {
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
  cleanup();
  cleanupDefaultPlugins();
}
