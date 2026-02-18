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
 * A plugin cache that tracks access order for LRU eviction.
 *
 * The `data` property returns a Proxy-backed object that transparently
 * moves keys to the end of an access-order queue on every `get` and `set`,
 * so plugins can keep using `cache.data[hash]` syntax unchanged.
 *
 * Eviction simply splices the first half of the queue — the least recently
 * used keys.
 */
export class PluginCache<T> {
  private entries: Record<string, T>;
  private accessOrder: string[];
  private _proxy: Record<string, T> | null = null;

  constructor(entries: Record<string, T> = {}, accessOrder: string[] = []) {
    this.entries = entries;
    this.accessOrder = accessOrder;
  }

  private touch(key: string): void {
    const idx = this.accessOrder.indexOf(key);
    if (idx !== -1) {
      this.accessOrder.splice(idx, 1);
    }
    this.accessOrder.push(key);
  }

  /**
   * Proxy-backed record. Property access and assignment both
   * move the key to the end of the access-order queue (most recent).
   */
  get data(): Record<string, T> {
    if (!this._proxy) {
      this._proxy = new Proxy(this.entries, {
        get: (target, prop, receiver) => {
          if (typeof prop === 'string' && prop in target) {
            this.touch(prop);
          }
          return Reflect.get(target, prop, receiver);
        },
        set: (target, prop, value, receiver) => {
          if (typeof prop === 'string') {
            this.touch(prop);
          }
          return Reflect.set(target, prop, value, receiver);
        },
        deleteProperty: (target, prop) => {
          if (typeof prop === 'string') {
            const idx = this.accessOrder.indexOf(prop);
            if (idx !== -1) {
              this.accessOrder.splice(idx, 1);
            }
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
   * Returns the serializable cache data (entries + accessOrder).
   */
  toSerializable(): PluginCacheData<T> {
    return {
      entries: this.entries,
      accessOrder: this.accessOrder,
    };
  }

  /**
   * Evicts the oldest 50% of entries (front of the access-order queue)
   * and returns a new PluginCache with the remaining entries.
   */
  evictOldestHalf(): PluginCache<T> {
    if (this.accessOrder.length === 0) return new PluginCache<T>();

    const toDelete = this.accessOrder.splice(
      0,
      Math.ceil(this.accessOrder.length / 2)
    );
    for (const key of toDelete) {
      delete this.entries[key];
    }
    return new PluginCache<T>(this.entries, this.accessOrder);
  }
}

/**
 * Reads a plugin cache from disk, returning a PluginCache instance.
 *
 * Backward compatible:
 * - Old format (plain Record<string, T>): all keys go into accessOrder as-is
 * - Previous timestamp format ({ entries, accessedAt }): keys sorted by timestamp
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

    // Previous timestamp format: { entries, accessedAt }
    if (
      raw &&
      typeof raw === 'object' &&
      'entries' in raw &&
      'accessedAt' in raw
    ) {
      const accessOrder = Object.keys(raw.entries).sort(
        (a, b) => (raw.accessedAt[a] ?? 0) - (raw.accessedAt[b] ?? 0)
      );
      return new PluginCache<T>(raw.entries, accessOrder);
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
 * 2. On failure: evict oldest 50% (front of access queue), retry
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
