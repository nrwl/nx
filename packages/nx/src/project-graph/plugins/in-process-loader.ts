// This file contains methods and utilities that should **only** be used by the plugin worker.

import { ProjectConfiguration } from '../../config/workspace-json-project-json';

import { getNxRequirePaths } from '../../utils/installation-directory';
import {
  PackageJson,
  readModulePackageJsonWithoutFallbacks,
} from '../../utils/package-json';
import { readJsonFile } from '../../utils/fileutils';

import type { PluginConfiguration } from '../../config/nx-json';
import type { LoadedNxPlugin } from './loaded-nx-plugin';
import { LoadPluginError } from '../error-types';
import path = require('node:path/posix');
import { resolveLocalNxPlugin, resolveNxPlugin } from './resolve-plugin';
import { withBuiltEntryResolutionHint } from './built-entry-resolution-hint';
import {
  pluginTranspilerIsRegistered,
  registerPluginTSTranspiler,
} from './transpiler';
import { handleImport } from '../../utils/handle-import';
import { registerSourceGraphResolver } from '../../plugins/js/utils/register';

export function readPluginPackageJson(
  pluginName: string,
  projects: Record<string, ProjectConfiguration>,
  paths = getNxRequirePaths()
): {
  path: string;
  json: PackageJson;
} {
  try {
    const result = readModulePackageJsonWithoutFallbacks(pluginName, paths);
    return {
      json: result.packageJson,
      path: result.path,
    };
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      const localPluginPath = resolveLocalNxPlugin(pluginName, projects);
      if (localPluginPath) {
        const localPluginPackageJson = path.join(
          localPluginPath.path,
          'package.json'
        );
        if (!pluginTranspilerIsRegistered()) {
          registerPluginTSTranspiler();
        }
        return {
          path: localPluginPackageJson,
          json: readJsonFile(localPluginPackageJson),
        };
      }
    }
    throw e;
  }
}

export function loadNxPlugin(
  plugin: PluginConfiguration,
  root: string,
  index?: number
) {
  let cleanupSourceGraphResolver = () => {};
  return [
    loadNxPluginAsync(
      plugin,
      getNxRequirePaths(root),
      root,
      index,
      (cleanup) => (cleanupSourceGraphResolver = cleanup)
    ),
    () => cleanupSourceGraphResolver(),
  ] as const;
}

export async function loadNxPluginAsync(
  pluginConfiguration: PluginConfiguration,
  paths: string[],
  root: string,
  index?: number,
  setCleanupSourceGraphResolver?: (cleanup: () => void) => void
): Promise<LoadedNxPlugin> {
  const moduleName =
    typeof pluginConfiguration === 'string'
      ? pluginConfiguration
      : pluginConfiguration.plugin;

  let resolvedPlugin: Awaited<ReturnType<typeof resolveNxPlugin>>;
  try {
    resolvedPlugin = await resolveNxPlugin(moduleName, root, paths);
  } catch (e) {
    throw new LoadPluginError(moduleName, e);
  }

  const {
    pluginPath,
    name,
    shouldRegisterTSTranspiler,
    isSourcePlugin,
    workspacePackageNames,
  } = resolvedPlugin;
  let cleanupSourceGraphResolver = () => {};

  try {
    if (isSourcePlugin) {
      cleanupSourceGraphResolver = registerSourceGraphResolver(
        pluginPath,
        root,
        workspacePackageNames
      );
      setCleanupSourceGraphResolver?.(cleanupSourceGraphResolver);
    }

    if (shouldRegisterTSTranspiler) {
      registerPluginTSTranspiler();
    }
    const { loadResolvedNxPluginAsync } = await handleImport(
      require.resolve('./load-resolved-plugin')
    );
    return await loadResolvedNxPluginAsync(
      pluginConfiguration,
      pluginPath,
      name,
      index
    );
  } catch (e) {
    cleanupSourceGraphResolver();
    setCleanupSourceGraphResolver?.(() => {});
    throw isSourcePlugin
      ? e
      : withBuiltEntryResolutionHint(
          e,
          pluginPath,
          root,
          workspacePackageNames
        );
  }
}
