// This file contains methods and utilities that should **only** be used by the plugin worker.

import { existsSync, realpathSync } from 'fs';
import { join } from 'path';
import { ProjectConfiguration } from '../../config/workspace-json-project-json';

import { getNxRequirePaths } from '../../utils/installation-directory';
import {
  PackageJson,
  readModulePackageJsonWithoutFallbacks,
} from '../../utils/package-json';
import { readJsonFile } from '../../utils/fileutils';
import { workspaceRootInner } from '../../utils/workspace-root';

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
import { workspaceRoot } from '@nx/devkit';

export function readPluginPackageJson(
  pluginName: string,
  projects: Record<string, ProjectConfiguration>,
  paths = getNxRequirePaths()
): {
  path: string;
  json: PackageJson;
} {
  console.log(
    `Reading plugin package.json for: ${pluginName} from paths: ${paths} at root: ${workspaceRoot}`
  );

  for (const searchPath of paths) {
    const directPackageJsonPath = join(
      searchPath,
      'node_modules',
      pluginName,
      'package.json'
    );
    console.log(`Checking direct path: ${directPackageJsonPath}`);
    console.log(`Path exists: ${existsSync(directPackageJsonPath)}`);
    
    if (existsSync(directPackageJsonPath)) {
      // Check if this is a symlink that points to a different workspace
      try {
        const realPath = realpathSync(directPackageJsonPath);
        const expectedWorkspaceRoot = workspaceRootInner(searchPath, null);
        const resolvedWorkspaceRoot = workspaceRootInner(realPath, null);
        
        console.log(`Real path: ${realPath}`);
        console.log(`Expected workspace root: ${expectedWorkspaceRoot}`);
        console.log(`Resolved workspace root: ${resolvedWorkspaceRoot}`);
        
        if (resolvedWorkspaceRoot !== expectedWorkspaceRoot) {
          console.log(`Skipping symlinked path from different workspace: ${realPath} (workspace: ${resolvedWorkspaceRoot}) vs expected (${expectedWorkspaceRoot})`);
          continue;
        }
        
        console.log(`Found package.json directly at: ${directPackageJsonPath} (real path: ${realPath})`);
        return {
          json: readJsonFile(directPackageJsonPath),
          path: directPackageJsonPath,
        };
      } catch (e) {
        console.log(`Error resolving real path for ${directPackageJsonPath}:`, e.message);
        continue;
      }
    }
  }

  try {
    const result = readModulePackageJsonWithoutFallbacks(pluginName, paths);
    console.log(
      `Found package.json via readModulePackageJsonWithoutFallbacks at: ${result.path}`
    );
    return {
      json: result.packageJson,
      path: result.path,
    };
  } catch (e) {
    console.log(
      `readModulePackageJsonWithoutFallbacks failed for ${pluginName}:`,
      e.message
    );
    if (e.code === 'MODULE_NOT_FOUND') {
      const localPluginPath = resolveLocalNxPlugin(pluginName, projects);
      if (localPluginPath) {
        const localPluginPackageJson = path.join(
          localPluginPath.path,
          'package.json'
        );
        console.log(
          `Falling back to local plugin at: ${localPluginPackageJson}`
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
