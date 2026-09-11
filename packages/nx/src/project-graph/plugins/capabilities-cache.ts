import { basename, dirname, isAbsolute, join, relative, sep } from 'node:path';
import { existsSync } from 'node:fs';

import {
  type CachedPluginCapabilities,
  FileLock,
  type PluginRecord,
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

/**
 * Records whose sources are unchanged since they were written.
 *
 * A record carries the files the plugin's load actually read, so validating one
 * is hashing exactly the code its answer came from. A record with no files came
 * from a plugin whose every source is vendored, and its key's version identifies
 * it on its own.
 */
export function readValidRecords(
  keys: string[],
  root: string
): Map<string, PluginCapabilities> {
  if (!keys.length) {
    return new Map();
  }
  try {
    const found = getCache()?.get(keys) ?? {};
    const valid = new Map<string, PluginCapabilities>();
    for (const [key, record] of Object.entries(found)) {
      if (recordIsFresh(record, root)) {
        valid.set(key, record.capabilities);
      } else {
        logger.verbose(
          `Sources behind the record for "${record.capabilities.name}" changed; loading it again`
        );
      }
    }
    return valid;
  } catch (e) {
    logger.verbose('Could not read cached plugin capabilities', e);
    return new Map();
  }
}

/**
 * Whether a record still describes its plugin.
 *
 * The files are the ones the plugin's load read, so this asks the only question
 * that matters: has any of the code that produced this answer changed? A file
 * outside that set cannot have contributed, and cannot start contributing
 * without an edit to a file inside it.
 *
 * A record with no files came from a plugin whose every source is vendored, and
 * its key's version identifies it.
 */
export function recordIsFresh(record: PluginRecord, root: string): boolean {
  if (!record.sourceFiles.length) {
    return true;
  }
  return hashSourceFiles(record.sourceFiles, root) === record.sourceHash;
}

/**
 * Hashes a closure in the order it was recorded, so the comparison does not
 * depend on the order a runtime happened to load it in.
 */
export function hashSourceFiles(sourceFiles: string[], root: string): string {
  return hashArray(
    sourceFiles.map((file) =>
      hashFile(isAbsolute(file) ? file : join(root, file))
    )
  );
}

/**
 * Workspace-relative where possible, so a record written in one worktree is
 * usable from another checkout of the same repository.
 */
export function relativizeSourceFiles(
  sourceFiles: string[],
  root: string
): string[] {
  return sourceFiles.map((file) => {
    const relativePath = relative(root, file);
    return relativePath.startsWith('..')
      ? normalizePath(file)
      : normalizePath(relativePath);
  });
}

export function recordCapabilities(
  entries: Array<{ key: string; record: PluginRecord }>
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
 * Identifies the plugin module. Nx's own version is part of every key, since a
 * record says what Nx believed about a module.
 *
 * The key says nothing about the module's CONTENTS: what a plugin registers
 * depends on whichever files its load happens to read, which is knowable only
 * after loading it once. The record carries those files, and reading one checks
 * them. So this only has to be stable and unambiguous, not fresh.
 *
 * Null for a plugin under `node_modules` that declares no version, which leaves
 * nothing to tell two different copies apart.
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
    return hashArray(['local', nxVersion(), id]);
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
