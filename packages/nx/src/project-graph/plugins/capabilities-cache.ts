import { dirname, join, relative, sep } from 'node:path';
import { existsSync } from 'node:fs';

import {
  type CachedPluginCapabilities,
  FileLock,
  hashArray,
  hashFile,
  IS_WASM,
  PluginCapabilitiesCache,
} from '../../native';
import { sharedDataDirectory } from '../../utils/cache-directory';
import { getDbConnection } from '../../utils/db-connection';
import { readJsonFile } from '../../utils/fileutils';
import { logger } from '../../utils/logger';
import { normalizePath } from '../../utils/path';
import { nxVersion } from '../../utils/versions';
import { hashWithWorkspaceContext } from '../../utils/workspace-context';
import { workspaceRoot } from '../../utils/workspace-root';
import type { LoadedNxPlugin } from './loaded-nx-plugin';

/**
 * What a plugin module registers. Unlike a {@link LoadedNxPlugin} this says
 * only whether a hook exists, which is what every caller that never runs a
 * hook actually needs.
 */
export type PluginCapabilities = CachedPluginCapabilities;

const LOCK_FILE_NAME = 'plugin-capabilities.lock';

const SOURCE_EXTENSIONS = '{ts,tsx,cts,mts,js,cjs,mjs}';

export function isCapabilityCacheEnabled(): boolean {
  // The database is not part of the WASM build, and isolation is disabled
  // there anyway, so there is no worker spawn to save.
  return !IS_WASM && process.env.NX_PLUGIN_CAPABILITY_CACHE !== 'false';
}

/**
 * Guards the record rather than the checkout, so it lives beside the database
 * it protects. Two worktrees sharing a database also share the load.
 */
export function createCapabilitiesLock(): FileLock | null {
  if (!isCapabilityCacheEnabled()) {
    return null;
  }
  try {
    return new FileLock(
      join(sharedDataDirectory(workspaceRoot, 'workspace-data'), LOCK_FILE_NAME)
    );
  } catch (e) {
    logger.verbose('Could not open the plugin capabilities lock', e);
    return null;
  }
}

let cache: PluginCapabilitiesCache | undefined;
function getCache(): PluginCapabilitiesCache | null {
  if (!isCapabilityCacheEnabled()) {
    return null;
  }
  try {
    cache ??= new PluginCapabilitiesCache(getDbConnection());
    return cache;
  } catch (e) {
    logger.verbose('Could not open the plugin capabilities cache', e);
    return null;
  }
}

export function readCachedCapabilities(
  keys: string[]
): Map<string, PluginCapabilities> {
  if (!keys.length) {
    return new Map();
  }
  try {
    const found = getCache()?.get(keys) ?? {};
    return new Map(Object.entries(found));
  } catch (e) {
    logger.verbose('Could not read cached plugin capabilities', e);
    return new Map();
  }
}

export function recordCapabilities(
  entries: Array<{ key: string; capabilities: PluginCapabilities }>
): void {
  if (!entries.length) {
    return;
  }
  try {
    getCache()?.record(entries);
  } catch (e) {
    logger.verbose('Could not record plugin capabilities', e);
  }
}

/**
 * The capabilities of a plugin that is already loaded, which is what gets
 * recorded. Reading them off the instance rather than the worker's reply means
 * an in-process load is recorded the same way an isolated one is.
 */
export function capabilitiesOfLoadedPlugin(
  plugin: LoadedNxPlugin
): PluginCapabilities {
  return {
    name: plugin.name,
    createNodesPattern: plugin.createNodes?.[0],
    hasCreateDependencies: !!plugin.createDependencies,
    hasCreateMetadata: !!plugin.createMetadata,
    hasPreTasksExecution: !!plugin.preTasksExecution,
    hasPostTasksExecution: !!plugin.postTasksExecution,
  };
}

export function sameCapabilities(
  a: PluginCapabilities,
  b: PluginCapabilities
): boolean {
  return (
    a.name === b.name &&
    a.createNodesPattern === b.createNodesPattern &&
    a.hasCreateDependencies === b.hasCreateDependencies &&
    a.hasCreateMetadata === b.hasCreateMetadata &&
    a.hasPreTasksExecution === b.hasPreTasksExecution &&
    a.hasPostTasksExecution === b.hasPostTasksExecution
  );
}

/**
 * Identifies the plugin module, so that two nx.json entries pointing at the
 * same module share a record and an upgrade never reuses one. Options are
 * deliberately absent: every capability is a presence check on the module's
 * static exports, and options are bound when a hook is called.
 *
 * Nx's own version is part of the key because a record says what Nx believed
 * about a module, and which hooks Nx looks for is Nx's to change. A release
 * that learns a new hook therefore reads no record written before it, rather
 * than reading a record whose missing field looks like "this plugin has no
 * such hook".
 *
 * Returns null for a module whose identity cannot be established, which is
 * then loaded as it was before.
 *
 * Deliberately not memoized per path. The daemon outlives edits to a local
 * plugin, so a remembered key would stop a change from invalidating anything.
 */
export async function computeCapabilityKey(
  pluginPath: string,
  root: string
): Promise<string | null> {
  if (!isCapabilityCacheEnabled()) {
    return null;
  }
  try {
    const id = pluginId(pluginPath, root);
    const installedVersion = readInstalledVersion(pluginPath);
    if (installedVersion) {
      return hashArray(['installed', nxVersion, id, installedVersion]);
    }
    return hashArray([
      'local',
      nxVersion,
      id,
      await hashPluginSource(pluginPath, root),
    ]);
  } catch (e) {
    logger.verbose(`Could not identify the plugin at ${pluginPath}`, e);
    return null;
  }
}

/**
 * Workspace-relative where possible, so worktrees of one repository share a
 * record for the same installed plugin.
 */
function pluginId(pluginPath: string, root: string): string {
  const relativePath = relative(root, pluginPath);
  return normalizePath(
    relativePath.startsWith('..') ? pluginPath : relativePath
  );
}

/**
 * The version of the installed package the module belongs to, or null when the
 * module is not installed. A package under `node_modules` cannot change without
 * its version changing, which is what makes the version sufficient on its own.
 */
function readInstalledVersion(pluginPath: string): string | null {
  if (!pluginPath.split(sep).includes('node_modules')) {
    return null;
  }

  // Starts at the resolved path itself, which is a directory when Node was
  // left to resolve the package's own `main`.
  let dir = pluginPath;
  let previous: string | undefined;
  while (dir !== previous) {
    const packageJsonPath = join(dir, 'package.json');
    if (existsSync(packageJsonPath)) {
      const { name, version } = readJsonFile(packageJsonPath);
      if (version) {
        return `${name ?? ''}@${version}`;
      }
    }
    previous = dir;
    dir = dirname(dir);
  }
  return null;
}

/**
 * Hashes the source a workspace-local plugin's exports could come from, which
 * is the whole project rather than the entry file, since a hook is commonly
 * declared in a module the entry re-exports.
 */
async function hashPluginSource(
  pluginPath: string,
  root: string
): Promise<string> {
  const projectRoot = findLocalProjectRoot(pluginPath, root);
  const globs = projectRoot
    ? [
        `${projectRoot}/**/*.${SOURCE_EXTENSIONS}`,
        `${projectRoot}/package.json`,
      ]
    : [pluginId(pluginPath, root)];

  // The entry file is hashed directly as well, because the globs run through
  // the workspace context and so skip anything the workspace ignores.
  return hashArray([
    hashFile(pluginPath),
    await hashWithWorkspaceContext(root, globs),
  ]);
}

function findLocalProjectRoot(pluginPath: string, root: string): string | null {
  let dir = dirname(pluginPath);
  while (dir.startsWith(root) && dir !== root) {
    if (
      existsSync(join(dir, 'package.json')) ||
      existsSync(join(dir, 'project.json'))
    ) {
      return normalizePath(relative(root, dir));
    }
    dir = dirname(dir);
  }
  return null;
}
