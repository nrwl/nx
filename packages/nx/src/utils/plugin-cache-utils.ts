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
  accessedAt: Record<string, number>;
}

/**
 * A plugin cache that tracks access timestamps for LRU eviction.
 *
 * The `data` property returns a Proxy-backed object that transparently
 * records `Date.now()` on every `get` and `set`, so plugins can keep
 * using `cache.data[hash]` syntax unchanged.
 */
export class PluginCache<T> {
  private entries: Record<string, T>;
  private accessedAt: Record<string, number>;
  private _proxy: Record<string, T> | null = null;

  constructor(
    entries: Record<string, T> = {},
    accessedAt: Record<string, number> = {}
  ) {
    this.entries = entries;
    this.accessedAt = accessedAt;
  }

  /**
   * Proxy-backed record. Property access and assignment both
   * update the LRU timestamp for the accessed key.
   */
  get data(): Record<string, T> {
    if (!this._proxy) {
      this._proxy = new Proxy(this.entries, {
        get: (target, prop, receiver) => {
          if (typeof prop === 'string' && prop in target) {
            this.accessedAt[prop] = Date.now();
          }
          return Reflect.get(target, prop, receiver);
        },
        set: (target, prop, value, receiver) => {
          if (typeof prop === 'string') {
            this.accessedAt[prop] = Date.now();
          }
          return Reflect.set(target, prop, value, receiver);
        },
        deleteProperty: (target, prop) => {
          if (typeof prop === 'string') {
            delete this.accessedAt[prop];
          }
          return Reflect.deleteProperty(target, prop);
        },
        has: (target, prop) => {
          return Reflect.has(target, prop);
        },
        ownKeys: (target) => {
          return Reflect.ownKeys(target);
        },
      });
    }
    return this._proxy;
  }

  /**
   * Returns the serializable cache data (entries + accessedAt).
   */
  toSerializable(): PluginCacheData<T> {
    return {
      entries: this.entries,
      accessedAt: this.accessedAt,
    };
  }

  /**
   * Returns a new PluginCache with the oldest 50% of entries removed
   * (by accessedAt timestamp).
   */
  evictOldestHalf(): PluginCache<T> {
    const keys = Object.keys(this.entries);
    if (keys.length === 0) return new PluginCache<T>();

    // Sort by accessedAt ascending (oldest first)
    const sorted = keys.sort(
      (a, b) => (this.accessedAt[a] ?? 0) - (this.accessedAt[b] ?? 0)
    );
    const keepFrom = Math.ceil(sorted.length / 2);

    const newEntries: Record<string, T> = {};
    const newAccessedAt: Record<string, number> = {};
    for (let i = keepFrom; i < sorted.length; i++) {
      const key = sorted[i];
      newEntries[key] = this.entries[key];
      newAccessedAt[key] = this.accessedAt[key] ?? 0;
    }
    return new PluginCache<T>(newEntries, newAccessedAt);
  }
}

/**
 * Reads a plugin cache from disk, returning a PluginCache instance.
 *
 * Backward compatible: if the file contains a plain Record<string, T>
 * (old format without accessedAt), all entries get accessedAt = 0 so
 * they are first to be evicted.
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

    // New format: { entries, accessedAt }
    if (
      raw &&
      typeof raw === 'object' &&
      'entries' in raw &&
      'accessedAt' in raw
    ) {
      return new PluginCache<T>(raw.entries, raw.accessedAt);
    }

    // Old format: plain Record<string, T> — migrate with accessedAt = 0
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const accessedAt: Record<string, number> = {};
      for (const key of Object.keys(raw)) {
        accessedAt[key] = 0;
      }
      return new PluginCache<T>(raw, accessedAt);
    }

    return new PluginCache<T>();
  } catch {
    return new PluginCache<T>();
  }
}

export interface SafeWritePluginCacheOptions {
  /** Path to a hash file that validates the cache */
  hashPath?: string;
  /** Hash value to write to the hash file */
  hash?: string;
}

/**
 * Safely writes a PluginCache to disk.
 *
 * Strategy:
 * 1. Attempt to serialize and write the full cache
 * 2. On failure: evict oldest 50% by accessedAt timestamp, retry
 * 3. On second failure: wipe cache file, log warning, return without throwing
 *
 * If `hashPath` and `hash` are provided in options, the hash file is written
 * ONLY after a successful cache write.
 */
export function safeWritePluginCache<T>(
  cachePath: string,
  cache: PluginCache<T>,
  options?: SafeWritePluginCacheOptions
): void {
  mkdirSync(dirname(cachePath), { recursive: true });

  // First attempt: write full cache
  if (tryWriteJson(cachePath, cache.toSerializable())) {
    writeHashFile(options);
    return;
  }

  // Second attempt: evict oldest 50% and retry
  const reduced = cache.evictOldestHalf();
  if (tryWriteJson(cachePath, reduced.toSerializable())) {
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

// --- Internal helpers ---

function tryWriteJson(path: string, data: unknown): boolean {
  try {
    const content = JSON.stringify(data);
    writeFileSync(path, content);
    return true;
  } catch {
    return false;
  }
}

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

function tryRemoveFile(path: string): void {
  try {
    unlinkSync(path);
  } catch {
    // Intentionally ignored — best effort
  }
}
