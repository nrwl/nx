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
export declare class PluginCache<T> {
    private entries;
    private accessOrder;
    private cachePath;
    /**
     * Constructs a `PluginCache`. The `cachePath` is the single source of truth
     * for both reading and writing — `writeToDisk()` writes to it.
     *
     * If `entries` is omitted, the cache is loaded from `cachePath` on disk.
     * If `entries` is provided, those entries are used as the in-memory state
     * and the on-disk file is not read (useful for tests or for seeding the
     * cache with known state).
     */
    constructor(cachePath: string, entries?: Record<string, T>, accessOrder?: string[] | Set<string>);
    private touch;
    /**
     * Returns the value for `key`, or `undefined` if not present.
     * Tracks the access in the session log for LRU ordering.
     */
    get(key: string): T | undefined;
    /**
     * Sets `key` to `value` and tracks the access in the session log.
     */
    set(key: string, value: T): void;
    /**
     * Returns `true` if `key` exists in the cache.
     * Does NOT track access — use this for existence checks that
     * should not affect eviction order.
     */
    has(key: string): boolean;
    /**
     * Returns the serializable cache data (entries + accessOrder).
     */
    toSerializable(): PluginCacheData<T>;
    /**
     * Safely writes this cache to the path it was constructed with.
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
    writeToDisk(): void;
    /**
     * Evicts the oldest 50% of entries (front of the access-order queue)
     * and returns the remaining entries + accessOrder as a plain object.
     */
    private evictOldestHalf;
}
/**
 * Safely writes already-stringified content to a cache file on disk.
 *
 * Strategy:
 * 1. Attempt mkdirSync + writeFileSync
 * 2. On failure: remove existing cache file, log warning, return without throwing
 */
export declare function safeWriteFileCache(cachePath: string, content: string): void;
export {};
