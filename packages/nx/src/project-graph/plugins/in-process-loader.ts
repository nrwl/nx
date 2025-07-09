// This file contains methods and utilities that should **only** be used by the plugin worker.

import { existsSync } from 'fs';
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
  console.log(`[DEBUG] readPluginPackageJson for ${pluginName}`);
  console.log(`[DEBUG] paths:`, paths);
  
  // First try to find the plugin directly in node_modules
  // This handles pnpm's symlink structure correctly
  for (const searchPath of paths) {
    const directPackageJsonPath = path.join(
      searchPath,
      'node_modules',
      pluginName,
      'package.json'
    );

    console.log(`[DEBUG] Checking direct path: ${directPackageJsonPath}`);
    if (existsSync(directPackageJsonPath)) {
      console.log(`[DEBUG] Found via direct path: ${directPackageJsonPath}`);
      return {
        json: readJsonFile(directPackageJsonPath),
        path: directPackageJsonPath,
      };
    }

    // If we are in the Nx repo that uses ts solutions `require.resolve` will find the source plugins,
    // for e.g. @nx/workspace -> packages/workspace instead of the installed version at node_modules/@nx/workspace.
    // We need to customize the resolution logic to ensure we read the package.json from the installed version.
    const nodeModulesPath = path.join(searchPath, 'node_modules');
    if (existsSync(nodeModulesPath)) {
      try {
        const pnpmDir = path.join(nodeModulesPath, '.pnpm');
        // pnpm can have a .pnpm directory if it is being used for example /tmp/tmp-6029-6bm08pq05OfH/node_modules/.pnpm/@nx+workspace@22.0.0/node_modules/@nx/workspace/src/generators/new/new.js\n'
        if (existsSync(pnpmDir)) {
          console.log(`[DEBUG] Checking pnpm dir: ${pnpmDir}`);
          const pnpmEntries = require('fs').readdirSync(pnpmDir);
          console.log(`[DEBUG] pnpm entries (showing first 10):`, pnpmEntries.slice(0, 10));
          for (const entry of pnpmEntries) {
            // Convert @nx/workspace to @nx+workspace pattern like above
            const expectedPattern = pluginName
              .replace('/', '+')
              .replace('@', '');
            console.log(`[DEBUG] Looking for pattern "${expectedPattern}" in entry "${entry}"`);
            if (entry.includes(expectedPattern)) {
              const possiblePath = path.join(
                pnpmDir,
                entry,
                'node_modules',
                pluginName,
                'package.json'
              );
              console.log(`[DEBUG] Checking pnpm path: ${possiblePath}`);
              // We skip the local package.json of the plugin itself since we are using ts solutions
              if (
                existsSync(possiblePath) &&
                !possiblePath.endsWith(`packages/${pluginName}/package.json`)
              ) {
                console.log(`[DEBUG] Found via pnpm path: ${possiblePath}`);
                return {
                  json: readJsonFile(possiblePath),
                  path: possiblePath,
                };
              } else {
                console.log(`[DEBUG] pnpm path not found or is workspace source: ${possiblePath}`);
              }
            }
          }
        }
      } catch (e) {
        console.error(`Error scanning pnpm, ${e.message}`);
      }
    }
  }

  try {
    // Try to resolve the plugin using require.resolve
    console.log(`[DEBUG] Trying readModulePackageJsonWithoutFallbacks for ${pluginName}`);
    const resolvedPath = readModulePackageJsonWithoutFallbacks(
      pluginName,
      paths
    );
    console.log(`[DEBUG] Found via readModulePackageJsonWithoutFallbacks: ${resolvedPath.path}`);
    return {
      json: resolvedPath.packageJson,
      path: resolvedPath.path,
    };
  } catch (e) {
    console.log(`[DEBUG] readModulePackageJsonWithoutFallbacks failed for ${pluginName}:`, e.message);
    if (e.code === 'MODULE_NOT_FOUND') {
      // Try local plugin as fallback
      console.log(`[DEBUG] Trying local plugin fallback for ${pluginName}`);
      const localPluginPath = resolveLocalNxPlugin(pluginName, projects);
      if (localPluginPath) {
        const localPluginPackageJson = path.join(
          localPluginPath.path,
          'package.json'
        );
        console.log(`[DEBUG] Found via local plugin: ${localPluginPackageJson}`);

        if (!pluginTranspilerIsRegistered()) {
          registerPluginTSTranspiler();
        }
        return {
          path: localPluginPackageJson,
          json: readJsonFile(localPluginPackageJson),
        };
      } else {
        console.log(`[DEBUG] No local plugin found for ${pluginName}`);
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
