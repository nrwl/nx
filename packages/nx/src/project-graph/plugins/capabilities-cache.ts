import { basename, dirname, extname, join, relative, sep } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';

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
import { workspaceRoot } from '../../utils/workspace-root';
import type { LoadedNxPlugin } from './loaded-nx-plugin';

/**
 * What a plugin module registers. Unlike a {@link LoadedNxPlugin} this says
 * only whether a hook exists, which is what every caller that never runs a
 * hook actually needs.
 */
export type PluginCapabilities = CachedPluginCapabilities;

const LOCK_FILE_NAME = 'plugin-capabilities.lock';

/**
 * The version of the Nx that is running, from its own manifest rather than
 * through `require('nx/package.json')`, which resolves to whichever Nx the
 * module graph finds first. A source build reports the placeholder version in
 * the repository, so a change to what Nx records from a plugin needs an
 * `nx reset` during development.
 */
let runningNxVersion: string | undefined;
function nxVersion(): string {
  runningNxVersion ??= readJsonFile<{ version?: string }>(
    join(__dirname, '../../../package.json')
  ).version;
  return runningNxVersion ?? '';
}

const SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.cts',
  '.mts',
  '.js',
  '.cjs',
  '.mjs',
]);

/** Not a plugin's own source, and the one directory that could make a walk large. */
const SKIPPED_DIRECTORIES = new Set(['node_modules', '.git']);

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
 * Identifies the plugin module, or returns null when that cannot be done, which
 * leaves the plugin to be loaded as it was before. Nx's own version is part of
 * every key, since a record says what Nx believed about a module.
 *
 * Not memoized per path: the daemon outlives edits to a local plugin, so a
 * remembered key would stop a change from invalidating anything.
 */
export function computeCapabilityKey(
  pluginPath: string,
  root: string
): string | null {
  if (!isCapabilityCacheEnabled()) {
    return null;
  }
  try {
    const id = pluginId(pluginPath, root);

    if (isInstalled(pluginPath)) {
      const version = readInstalledVersion(pluginPath);
      return version
        ? hashArray(['installed', nxVersion(), id, version])
        : null;
    }

    // Without a project there is nothing to hash but the entry file, and a hook
    // the entry re-exports would never move the key. Declining costs this
    // plugin the load it paid for before the records existed.
    const projectRoot = findLocalProjectRoot(pluginPath, root);
    if (!projectRoot) {
      return null;
    }

    return hashArray([
      'local',
      nxVersion(),
      id,
      hashPluginSource(join(root, projectRoot), pluginPath),
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

function isInstalled(pluginPath: string): boolean {
  return pluginPath.split(sep).includes('node_modules');
}

/**
 * The version of the installed package the module belongs to, or null when that
 * package declares none. Identifying an installed package by its version is the
 * same assumption Nx makes when it hashes task inputs from a lockfile; a tool
 * that rewrites a package in place, such as patch-package, defeats both.
 *
 * The walk stops at the `node_modules` holding the package, so a package with
 * no version is declined rather than taking the version of whatever sits above
 * it, which would be the workspace's own.
 */
function readInstalledVersion(pluginPath: string): string | null {
  // Starts at the resolved path itself, which is a directory when Node was
  // left to resolve the package's own `main`.
  let dir = pluginPath;
  let previous: string | undefined;
  while (dir !== previous && basename(dir) !== 'node_modules') {
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
 * Hashes the sources a workspace-local plugin's exports can come from, which is
 * its whole project rather than its entry file, since a hook is commonly
 * declared in a module the entry re-exports.
 *
 * Walked directly rather than through the workspace context, which would skip
 * whatever the workspace ignores: generated or ignored code a plugin re-exports
 * is still code whose exports decide what the record says.
 *
 * A module in ANOTHER project is still outside this, and no hash rooted at one
 * project can see it. That is the remaining limit of identifying a local plugin
 * by its own project's sources.
 */
function hashPluginSource(projectRoot: string, pluginPath: string): string {
  const sources: string[] = [];
  collectSources(projectRoot, sources);
  // Sorted so the key does not depend on the order the filesystem happens to
  // return entries in.
  sources.sort();
  return hashArray([
    hashFile(pluginPath),
    ...sources.map((file) => hashFile(file)),
  ]);
}

function collectSources(dir: string, into: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) {
        collectSources(join(dir, entry.name), into);
      }
    } else if (
      SOURCE_EXTENSIONS.has(extname(entry.name)) ||
      entry.name === 'package.json'
    ) {
      into.push(join(dir, entry.name));
    }
  }
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
