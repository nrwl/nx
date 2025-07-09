// This file contains methods and utilities that should **only** be used by the plugin worker.

import { existsSync } from 'fs';
import { ProjectConfiguration } from '../../config/workspace-json-project-json';

import { getNxRequirePaths } from '../../utils/installation-directory';
import {
  PackageJson,
  readModulePackageJsonWithoutFallbacks,
} from '../../utils/package-json';
import { readJsonFile } from '../../utils/fileutils';
import { scanPnpmForPlugin } from './pnpm-utils';

import type { PluginConfiguration } from '../../config/nx-json';
import type { LoadedNxPlugin } from './loaded-nx-plugin';
import { LoadPluginError } from '../error-types';
import path = require('node:path/posix');
import { loadResolvedNxPluginAsync } from './load-resolved-plugin';
import { resolveLocalNxPlugin, resolveNxPlugin } from './resolve-plugin';
import {
  pluginTranspilerIsRegistered,
  registerPluginTSTranspiler,
} from './transpiler';

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
      // If require.resolve fails, try pnpm scanning as fallback
      // This is needed when we are in the Nx repo that uses ts solutions and `require.resolve` finds the source plugins
      // Because the original __dirname is passed
      for (const searchPath of paths) {
        const nodeModulesPath = path.join(searchPath, 'node_modules');
        if (existsSync(nodeModulesPath)) {
          const pnpmDir = path.join(nodeModulesPath, '.pnpm');
          const result = scanPnpmForPlugin(pluginName, pnpmDir);
          if (result) {
            return result;
          }
        }
      }

      // Try local plugin as final fallback
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

    console.error(e);
    throw new Error(
      `Plugin ${pluginName} not found in workspace. Ensure it is properly installed as a dependency.`
    );
  }
}

export function loadNxPlugin(plugin: PluginConfiguration, root: string) {
  return [
    loadNxPluginAsync(plugin, getNxRequirePaths(root), root),
    () => {},
  ] as const;
}

export async function loadNxPluginAsync(
  pluginConfiguration: PluginConfiguration,
  paths: string[],
  root: string
): Promise<LoadedNxPlugin> {
  const moduleName =
    typeof pluginConfiguration === 'string'
      ? pluginConfiguration
      : pluginConfiguration.plugin;
  try {
    const { pluginPath, name, shouldRegisterTSTranspiler } =
      await resolveNxPlugin(moduleName, root, paths);

    if (shouldRegisterTSTranspiler) {
      registerPluginTSTranspiler();
    }
    return loadResolvedNxPluginAsync(pluginConfiguration, pluginPath, name);
  } catch (e) {
    throw new LoadPluginError(moduleName, e);
  }
}
