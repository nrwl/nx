import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from 'node:fs';
import { dirname } from 'node:path';
import { logger } from './logger';

/**
 * On-disk format for plugin caches with LRU metadata.
 */
interface PluginCacheData<T> {
  entries: Record<string, T>;
  accessOrder: string[];
}

/**
 * A plugin cache with explicit get/set that tracks access order for LRU eviction.
 *
 * Access tracking is append-only during the session (just an array push).
 * Dedup and capping happen once at write time via `toSerializable()`.
 */
export class PluginCache<T> {
  private entries: Record<string, T>;
  private accessOrder: string[];
  private sessionLog: string[] = [];

  constructor(entries: Record<string, T> = {}, accessOrder: string[] = []) {
    this.entries = entries;
    this.accessOrder = accessOrder;
  }

  get(key: string): T | undefined {
    if (key in this.entries) {
      this.sessionLog.push(key);
      return this.entries[key];
    }
    return undefined;
  }

  set(key: string, value: T): void {
    this.entries[key] = value;
    this.sessionLog.push(key);
  }

  has(key: string): boolean {
    return key in this.entries;
  }

  /**
   * Serialize for writing to disk.
   *
   * 1. Dedupes the session log (last occurrence = most recent)
   * 2. Keys not accessed this session keep their prior order at the front
   * 3. If maxEntries is set, drops oldest entries from the front
   */
  toSerializable(maxEntries?: number): PluginCacheData<T> {
    const accessed = new Set<string>();
    const recentFirst: string[] = [];

    // Walk session log backwards so last occurrence wins
    for (let i = this.sessionLog.length - 1; i >= 0; i--) {
      const key = this.sessionLog[i];
      if (!accessed.has(key) && key in this.entries) {
        accessed.add(key);
        recentFirst.push(key);
      }
    }

    // Build final order: unaccessed keys first (old order), then accessed keys (most recent last)
    const order: string[] = [];
    for (const key of this.accessOrder) {
      if (!accessed.has(key) && key in this.entries) {
        order.push(key);
      }
    }
    // Add any new keys not in the original accessOrder and not in session log
    for (const key of Object.keys(this.entries)) {
      if (!accessed.has(key) && !order.includes(key)) {
        order.push(key);
      }
    }
    // Append accessed keys, reversed so most recent is last
    for (let i = recentFirst.length - 1; i >= 0; i--) {
      order.push(recentFirst[i]);
    }

    // Cap if needed
    if (maxEntries && order.length > maxEntries) {
      const toKeep = order.slice(order.length - maxEntries);
      const keepSet = new Set(toKeep);
      const capped: Record<string, T> = {};
      for (const k of toKeep) {
        capped[k] = this.entries[k];
      }
      return { entries: capped, accessOrder: toKeep };
    }

    return { entries: { ...this.entries }, accessOrder: order };
  }
}

/**
 * Reads a plugin cache from disk, returning a PluginCache instance.
 *
 * Backward compatible with old format: if file contains a plain
 * Record<string, T>, all keys start in access order as-is.
 */
export function readPluginCache<T>(cachePath: string): PluginCache<T> {
  try {
    if (
      process.env.NX_CACHE_PROJECT_GRAPH === 'false' ||
      !existsSync(cachePath)
    ) {
      return new PluginCache<T>();
    }
    const raw = JSON.parse(readFileSync(cachePath, 'utf-8'));

    // Current format: { entries, accessOrder }
    if (
      raw &&
      typeof raw === 'object' &&
      'entries' in raw &&
      'accessOrder' in raw &&
      Array.isArray(raw.accessOrder)
    ) {
      return new PluginCache<T>(raw.entries, raw.accessOrder);
    }

    // Legacy format: plain Record<string, T>
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      return new PluginCache<T>(raw, Object.keys(raw));
    }

    return new PluginCache<T>();
  } catch {
    return new PluginCache<T>();
  }
}

export interface SafeWriteOptions {
  /** Maximum number of entries to keep. Oldest (least recently used) are dropped. */
  maxEntries?: number;
  /** Path to a hash file that validates the cache */
  hashPath?: string;
  /** Hash value to write to the hash file */
  hash?: string;
}

/**
 * Safely writes a PluginCache to disk.
 *
 * - Caps entries if maxEntries is set
 * - On write failure: warns and removes corrupted file (never throws)
 * - Writes hash file only after successful cache write
 */
export function safeWritePluginCache<T>(
  cachePath: string,
  cache: PluginCache<T>,
  options?: SafeWriteOptions
): void {
  try {
    mkdirSync(dirname(cachePath), { recursive: true });
    const data = cache.toSerializable(options?.maxEntries);
    writeFileSync(cachePath, JSON.stringify(data));
  } catch (e) {
    logger.warn(
      `Failed to write plugin cache at ${cachePath}: ${
        e instanceof Error ? e.message : 'unknown error'
      }. Continuing without cache.`
    );
    tryRemoveFile(cachePath);
    if (options?.hashPath) {
      tryRemoveFile(options.hashPath);
    }
    return;
  }

  // Hash file written only after successful cache write
  if (options?.hashPath && options?.hash) {
    try {
      mkdirSync(dirname(options.hashPath), { recursive: true });
      writeFileSync(options.hashPath, options.hash);
    } catch (e) {
      logger.warn(
        `Failed to write cache hash file at ${options.hashPath}: ${
          e instanceof Error ? e.message : 'unknown error'
        }`
      );
    }
  }
}

/**
 * Safely writes already-stringified content to a cache file on disk.
 * On failure: warns and removes existing file (never throws).
 */
export function safeWriteFileCache(cachePath: string, content: string): void {
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

function tryRemoveFile(path: string): void {
  try {
    unlinkSync(path);
  } catch {
    // Best effort
  }
}
