import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { readJsonFile } from './fileutils';
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
 * Uses explicit `get()` / `set()` / `has()` methods instead of a Proxy
 * for easier debugging and predictable behavior.
 *
 * Access order is tracked via an append-only session log. Deduplication
 * happens once at serialization time (`toSerializable()`), keeping per-access
 * cost at O(1).
 *
 * Eviction splices the first half of the deduped access-order queue — the
 * least recently used keys.
 */
export class PluginCache<T> {
  private entries: Record<string, T>;
  private accessOrder: Set<string>;

  constructor(cachePath: string);
  constructor(
    entries?: Record<string, T>,
    accessOrder?: string[] | Set<string>
  );
  constructor(
    cachePathOrEntries?: string | Record<string, T>,
    accessOrder?: string[] | Set<string>
  ) {
    if (typeof cachePathOrEntries === 'string') {
      const loaded = loadFromDisk<T>(cachePathOrEntries);
      this.entries = loaded.entries;
      this.accessOrder = loaded.accessOrder;
    } else {
      this.entries = cachePathOrEntries ?? {};
      this.accessOrder =
        accessOrder instanceof Set ? accessOrder : new Set(accessOrder ?? []);
    }
  }

  private touch(key: string): void {
    // Sets are guaranteed to maintain insertion order, so we can delete and re-add to move it to the end.
    this.accessOrder.delete(key); // remove from current position in access order
    this.accessOrder.add(key); // add to end of access order (most recently accessed)
  }

  /**
   * Returns the value for `key`, or `undefined` if not present.
   * Tracks the access in the session log for LRU ordering.
   */
  get(key: string): T | undefined {
    if (key in this.entries) {
      this.touch(key);
      return this.entries[key];
    }
    return undefined;
  }

  /**
   * Sets `key` to `value` and tracks the access in the session log.
   */
  set(key: string, value: T): void {
    this.entries[key] = value;
    this.touch(key);
  }

  /**
   * Returns `true` if `key` exists in the cache.
   * Does NOT track access — use this for existence checks that
   * should not affect eviction order.
   */
  has(key: string): boolean {
    return key in this.entries;
  }

  /**
   * Returns the serializable cache data (entries + accessOrder).
   */
  toSerializable(): PluginCacheData<T> {
    return {
      entries: this.entries,
      accessOrder: [...this.accessOrder],
    };
  }

  /**
   * Safely writes this cache to disk.
   *
   * Strategy:
   * 1. Serialize to JSON
   *    - RangeError (string too large): evict oldest 50% and retry
   *    - Other errors (e.g. circular refs): skip straight to empty cache
   * 2. Write the serialized string to disk — if this fails (fs error),
   *    wipe the cache file so a corrupted file doesn't persist
   * 3. On total serialization failure (even after eviction),
   *    write an empty cache so the file is valid
   */

  writeToDisk(cachePath: string): void {
    mkdirSync(dirname(cachePath), { recursive: true });

    let content: string | undefined;

    try {
      content = JSON.stringify({
        entries: this.entries,
        accessOrder: [...this.accessOrder],
      });
    } catch (e) {
      // RangeError → string too large, recoverable via eviction
      if (e instanceof RangeError) {
        const reduced = this.evictOldestHalf();
        // Update in-memory state
        this.entries = reduced.entries;
        this.accessOrder = new Set(reduced.accessOrder);
        try {
          content = JSON.stringify(reduced);
        } catch {
          // Still fails after eviction — fall through to empty cache
        }
      }
      // Other errors (TypeError for circular refs, etc.) fall through to empty cache
    }

    // If serialization still fails, fall back to an empty cache
    if (content === undefined) {
      content = JSON.stringify({ entries: {}, accessOrder: [] });
    }

    // Attempt to write the serialized content to disk
    try {
      writeFileSync(cachePath, content);
    } catch {
      // Filesystem error — wipe cache so a corrupted file doesn't persist
      tryRemoveFile(cachePath);
    }
  }

  /**
   * Evicts the oldest 50% of entries (front of the access-order queue)
   * and returns the remaining entries + accessOrder as a plain object.
   */
  private evictOldestHalf(): PluginCacheData<T> {
    const accessOrderArr = [...this.accessOrder];
    if (accessOrderArr.length === 0) return { entries: {}, accessOrder: [] };

    const cutoff = Math.ceil(accessOrderArr.length / 2);
    const remaining = accessOrderArr.slice(cutoff);

    const entries: Record<string, T> = {};
    for (const key of remaining) {
      if (key in this.entries) {
        entries[key] = this.entries[key];
      }
    }

    return { entries, accessOrder: remaining };
  }
}

/**
 * Loads plugin cache data from disk.
 *
 * Returns the current format `{ entries, accessOrder }` if it matches,
 * otherwise returns an empty cache (no backward compat — stale caches
 * are simply discarded).
 */
function loadFromDisk<T>(cachePath: string): {
  entries: Record<string, T>;
  accessOrder: Set<string>;
} {
  const empty = {
    entries: {} as Record<string, T>,
    accessOrder: new Set<string>(),
  };
  try {
    if (
      process.env.NX_CACHE_PROJECT_GRAPH === 'false' ||
      !existsSync(cachePath)
    ) {
      return empty;
    }
    const raw = readJsonFile<PluginCacheData<T>>(cachePath);

    // Current format: { entries, accessOrder }
    if (
      raw &&
      typeof raw === 'object' &&
      'entries' in raw &&
      'accessOrder' in raw &&
      Array.isArray(raw.accessOrder)
    ) {
      return { entries: raw.entries, accessOrder: new Set(raw.accessOrder) };
    }

    return empty;
  } catch {
    return empty;
  }
}

/**
 * Safely writes already-stringified content to a cache file on disk.
 *
 * Strategy:
 * 1. Attempt mkdirSync + writeFileSync
 * 2. On failure: remove existing cache file, log warning, return without throwing
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

// --- Internal helpers ---

function tryRemoveFile(path: string): void {
  try {
    unlinkSync(path);
  } catch {
    // Intentionally ignored — best effort
  }
}
