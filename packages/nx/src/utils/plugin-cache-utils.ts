import { mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname } from 'node:path';
import { logger } from './logger';

export interface SafeWritePluginCacheOptions {
  /** Path to a hash file that validates the cache */
  hashPath?: string;
  /** Hash value to write to the hash file */
  hash?: string;
}

/**
 * Attempts to JSON.stringify and write data to the given path.
 * Returns true on success, false on failure.
 */
function tryWriteJson(path: string, data: unknown): boolean {
  try {
    const content = JSON.stringify(data);
    writeFileSync(path, content);
    return true;
  } catch {
    return false;
  }
}

/**
 * Writes the hash file if both hashPath and hash are provided.
 */
function writeHashFile(options?: SafeWritePluginCacheOptions): void {
  if (!options?.hashPath || !options?.hash) {
    return;
  }
  try {
    mkdirSync(dirname(options.hashPath), { recursive: true });
    writeFileSync(options.hashPath, options.hash);
  } catch (e) {
    logger.warn(
      `Failed to write plugin cache hash file at ${options.hashPath}: ${
        e instanceof Error ? e.message : 'unknown error'
      }`
    );
  }
}

/**
 * Returns a new object containing only the last 50% of entries
 * (by insertion order) from the given record.
 */
function evictOldestHalf<T>(data: Record<string, T>): Record<string, T> {
  const keys = Object.keys(data);
  const halfIndex = Math.ceil(keys.length / 2);
  const result: Record<string, T> = {};
  for (let i = halfIndex; i < keys.length; i++) {
    result[keys[i]] = data[keys[i]];
  }
  return result;
}

/**
 * Best-effort file removal. Silently ignores errors.
 */
function tryRemoveFile(path: string): void {
  try {
    unlinkSync(path);
  } catch {
    // Intentionally ignored — best effort
  }
}

/**
 * Safely writes a hash-map (Record<string, T>) plugin cache to disk.
 *
 * Strategy:
 * 1. Attempt JSON.stringify + writeFileSync
 * 2. On failure: evict 50% of entries (oldest by insertion order), retry
 * 3. On second failure: wipe cache file, log warning, return without throwing
 *
 * If `hashPath` and `hash` are provided in options, the hash file is written
 * ONLY after a successful cache write.
 */
export function safeWritePluginCache<T>(
  cachePath: string,
  data: Record<string, T>,
  options?: SafeWritePluginCacheOptions
): void {
  mkdirSync(dirname(cachePath), { recursive: true });

  // First attempt
  if (tryWriteJson(cachePath, data)) {
    writeHashFile(options);
    return;
  }

  // Second attempt with evicted data
  const reduced = evictOldestHalf(data);
  if (tryWriteJson(cachePath, reduced)) {
    logger.warn(
      `Plugin cache at ${cachePath} exceeded capacity. Evicted 50% of entries.`
    );
    writeHashFile(options);
    return;
  }

  // Total failure — wipe cache so a corrupted file doesn't persist
  tryRemoveFile(cachePath);
  if (options?.hashPath) {
    tryRemoveFile(options.hashPath);
  }
  logger.warn(
    `Failed to write plugin cache at ${cachePath}. Cache has been cleared.`
  );
}

/**
 * Safely writes already-stringified content to a cache file on disk.
 *
 * Strategy:
 * 1. Attempt mkdirSync + writeFileSync
 * 2. On failure: remove existing cache file, log warning, return without throwing
 */
export function safeWriteCache(cachePath: string, content: string): void {
  try {
    mkdirSync(dirname(cachePath), { recursive: true });
    writeFileSync(cachePath, content);
  } catch (e) {
    logger.warn(
      `Failed to write cache at ${cachePath}: ${
        e instanceof Error ? e.message : 'unknown error'
      }. Removing existing cache file.`
    );
    tryRemoveFile(cachePath);
  }
}
