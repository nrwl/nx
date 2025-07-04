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
  console.log(
    `Reading plugin package.json for: ${pluginName} from paths: ${paths}`
  );

  // First try to find the plugin directly in node_modules
  // This handles pnpm's symlink structure correctly
  for (const searchPath of paths) {
    // Check standard node_modules location (symlink)
    const directPackageJsonPath = path.join(
      searchPath,
      'node_modules',
      pluginName,
      'package.json'
    );
    console.log(`Checking direct path: ${directPackageJsonPath}`);

    if (existsSync(directPackageJsonPath)) {
      console.log(`Found package.json directly at: ${directPackageJsonPath}`);
      return {
        json: readJsonFile(directPackageJsonPath),
        path: directPackageJsonPath,
      };
    }

    // Check pnpm .pnpm directory structure (only for pnpm)
    const nodeModulesPath = path.join(searchPath, 'node_modules');
    if (existsSync(nodeModulesPath)) {
      try {
        const pnpmDir = path.join(nodeModulesPath, '.pnpm');
        // pnpm can have a .pnpm directory if it is being used for example /tmp/tmp-6029-6bm08pq05OfH/node_modules/.pnpm/@nx+workspace@22.0.0/node_modules/@nx/workspace/src/generators/new/new.js\n'
        if (existsSync(pnpmDir)) {
          console.log(`Scanning pnpm .pnpm directory: ${pnpmDir}`);
          const pnpmEntries = require('fs').readdirSync(pnpmDir);
          for (const entry of pnpmEntries) {
            // Convert @nx/workspace to @nx+workspace pattern like above
            const expectedPattern = pluginName
              .replace('/', '+')
              .replace('@', '');
            if (entry.includes(expectedPattern)) {
              const possiblePath = path.join(
                pnpmDir,
                entry,
                'node_modules',
                pluginName,
                'package.json'
              );
              if (existsSync(possiblePath)) {
                console.log(
                  `Found package.json in pnpm structure: ${possiblePath}`
                );
                return {
                  json: readJsonFile(possiblePath),
                  path: possiblePath,
                };
              }
            }
          }
        }
      } catch (e) {
        console.error(`Error scanning pnpm, ${e.message}`);
      }
    }
  }

  // Try local plugin as fallback
  const localPluginPath = resolveLocalNxPlugin(pluginName, projects);
  if (localPluginPath) {
    const localPluginPackageJson = path.join(
      localPluginPath.path,
      'package.json'
    );
    console.log(`Found local plugin at: ${localPluginPackageJson}`);
    if (!pluginTranspilerIsRegistered()) {
      registerPluginTSTranspiler();
    }
    return {
      path: localPluginPackageJson,
      json: readJsonFile(localPluginPackageJson),
    };
  }

  throw new Error(
    `Plugin ${pluginName} not found in workspace. Ensure it is properly installed as a dependency.`
  );
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
