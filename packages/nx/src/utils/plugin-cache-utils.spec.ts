import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  PluginCache,
  readPluginCache,
  safeWriteFileCache,
} from './plugin-cache-utils';

describe('plugin-cache-utils', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nx-cache-utils-test-'));
  });

  describe('PluginCache', () => {
    it('should track access in session log on get', () => {
      const cache = new PluginCache<string>({ a: '1', b: '2', c: '3' }, [
        'a',
        'b',
        'c',
      ]);

      cache.get('a'); // access 'a', moves to end

      const serialized = cache.toSerializable();
      expect(serialized.accessOrder).toEqual(['b', 'c', 'a']);
    });

    it('should track access in session log on set', () => {
      const cache = new PluginCache<string>({}, []);
      cache.set('x', 'hello');
      cache.set('y', 'world');

      const serialized = cache.toSerializable();
      expect(serialized.entries['x']).toBe('hello');
      expect(serialized.entries['y']).toBe('world');
      expect(serialized.accessOrder).toEqual(['x', 'y']);
    });

    it('should move existing key to end on set', () => {
      const cache = new PluginCache<string>({ a: '1', b: '2' }, ['a', 'b']);
      cache.set('a', 'updated'); // re-set 'a', moves to end

      const serialized = cache.toSerializable();
      expect(serialized.accessOrder).toEqual(['b', 'a']);
    });

    it('should NOT track access on has()', () => {
      const cache = new PluginCache<string>({ a: '1', b: '2' }, ['a', 'b']);
      expect(cache.has('a')).toBe(true);
      expect(cache.has('c')).toBe(false);

      // No access tracked, so order should be unchanged
      const serialized = cache.toSerializable();
      expect(serialized.accessOrder).toEqual(['a', 'b']);
    });

    it('should return undefined for missing keys on get', () => {
      const cache = new PluginCache<string>({ a: '1' }, ['a']);
      expect(cache.get('missing')).toBeUndefined();

      // Missing key should not appear in session log
      const serialized = cache.toSerializable();
      expect(serialized.accessOrder).toEqual(['a']);
    });

    it('should dedup session log at serialization: access a→b→a expects [b, a]', () => {
      const cache = new PluginCache<string>({ a: '1', b: '2', c: '3' }, [
        'a',
        'b',
        'c',
      ]);

      cache.get('a');
      cache.get('b');
      cache.get('a'); // duplicate access

      const serialized = cache.toSerializable();
      // c was unaccessed → stays at front
      // b then a based on last access
      expect(serialized.accessOrder).toEqual(['c', 'b', 'a']);
    });

    it('should place new keys (from set) after unaccessed but before accessed', () => {
      const cache = new PluginCache<string>({ a: '1' }, ['a']);

      cache.set('new1', 'v1');
      cache.get('a');

      const serialized = cache.toSerializable();
      // 'new1' is a new key not in original accessOrder → placed after unaccessed
      // 'a' was accessed → placed at end
      expect(serialized.accessOrder).toEqual(['new1', 'a']);
    });
  });

  describe('readPluginCache', () => {
    it('should read current format with entries and accessOrder', () => {
      const cachePath = join(tempDir, 'cache.json');
      writeFileSync(
        cachePath,
        JSON.stringify({
          entries: { a: '1', b: '2' },
          accessOrder: ['b', 'a'],
        })
      );

      const cache = readPluginCache<string>(cachePath);
      expect(cache.get('a')).toBe('1');
      expect(cache.toSerializable().accessOrder).toContain('a');
      expect(cache.toSerializable().accessOrder).toContain('b');
    });

    it('should migrate previous timestamp format', () => {
      const cachePath = join(tempDir, 'old-ts-cache.json');
      writeFileSync(
        cachePath,
        JSON.stringify({
          entries: { stale: '1', fresh: '2' },
          accessedAt: { stale: 100, fresh: 999 },
        })
      );

      const cache = readPluginCache<string>(cachePath);
      const serialized = cache.toSerializable();

      // Should be sorted by accessedAt: stale (100) before fresh (999)
      expect(serialized.accessOrder).toEqual(['stale', 'fresh']);
      expect(serialized.entries).toEqual({ stale: '1', fresh: '2' });
    });

    it('should migrate legacy plain Record format', () => {
      const cachePath = join(tempDir, 'legacy-cache.json');
      writeFileSync(cachePath, JSON.stringify({ a: '1', b: '2' }));

      const cache = readPluginCache<string>(cachePath);
      const serialized = cache.toSerializable();

      expect(serialized.entries).toEqual({ a: '1', b: '2' });
      expect(serialized.accessOrder).toEqual(['a', 'b']);
    });

    it('should return empty cache if file does not exist', () => {
      const cache = readPluginCache<string>(join(tempDir, 'nope.json'));
      expect(cache.has('anything')).toBe(false);
    });

    it('should return empty cache if file is corrupted', () => {
      const cachePath = join(tempDir, 'bad.json');
      writeFileSync(cachePath, 'not json!!!');

      const cache = readPluginCache<string>(cachePath);
      expect(cache.has('anything')).toBe(false);
    });
  });

  describe('writeToDisk', () => {
    it('should write cache with entries and accessOrder', () => {
      const cachePath = join(tempDir, 'plugin-cache.json');
      const cache = new PluginCache<string>({ a: '1' }, ['a']);

      cache.writeToDisk(cachePath);

      const written = JSON.parse(readFileSync(cachePath, 'utf-8'));
      expect(written.entries).toEqual({ a: '1' });
      expect(written.accessOrder).toEqual(['a']);
    });

    it('should evict oldest 50% when RangeError and retry', () => {
      const cachePath = join(tempDir, 'plugin-cache.json');

      const entries: Record<string, any> = {};
      const accessOrder: string[] = [];
      for (let i = 0; i < 10; i++) {
        entries[`key${i}`] = `value${i}`;
        accessOrder.push(`key${i}`);
      }
      // Value whose toJSON throws RangeError to simulate "string too large"
      entries['key0'] = {
        toJSON() {
          throw new RangeError('Invalid string length');
        },
      };

      const cache = new PluginCache(entries, accessOrder);
      cache.writeToDisk(cachePath);

      // key0-key4 evicted (front of queue), key5-key9 remain
      const written = JSON.parse(readFileSync(cachePath, 'utf-8'));
      expect(Object.keys(written.entries).length).toBe(5);
      expect(written.entries['key5']).toBe('value5');
      expect(written.entries['key9']).toBe('value9');
      expect(written.entries['key0']).toBeUndefined();
      expect(written.accessOrder).toEqual([
        'key5',
        'key6',
        'key7',
        'key8',
        'key9',
      ]);
    });

    it('should write empty cache when circular ref (TypeError) is encountered', () => {
      const cachePath = join(tempDir, 'plugin-cache.json');
      const circular: any = { self: null };
      circular.self = circular;

      const cache = new PluginCache({ a: circular }, ['a']);
      cache.writeToDisk(cachePath);

      // Circular refs are a hard error — skips eviction, writes empty cache
      expect(existsSync(cachePath)).toBe(true);
      const written = JSON.parse(readFileSync(cachePath, 'utf-8'));
      expect(written.entries).toEqual({});
      expect(written.accessOrder).toEqual([]);
    });

    it('should write empty cache when RangeError persists after eviction', () => {
      const cachePath = join(tempDir, 'plugin-cache.json');
      const entries: Record<string, any> = {};
      const accessOrder: string[] = [];
      for (let i = 0; i < 4; i++) {
        entries[`key${i}`] = {
          toJSON() {
            throw new RangeError('Invalid string length');
          },
        };
        accessOrder.push(`key${i}`);
      }

      const cache = new PluginCache(entries, accessOrder);
      cache.writeToDisk(cachePath);

      // Should write an empty cache (not delete the file)
      expect(existsSync(cachePath)).toBe(true);
      const written = JSON.parse(readFileSync(cachePath, 'utf-8'));
      expect(written.entries).toEqual({});
      expect(written.accessOrder).toEqual([]);
    });

    it('should evict based on LRU order when accessed keys exist', () => {
      const cachePath = join(tempDir, 'plugin-cache.json');

      const entries: Record<string, any> = {};
      const accessOrder: string[] = [];
      for (let i = 0; i < 10; i++) {
        entries[`key${i}`] = `value${i}`;
        accessOrder.push(`key${i}`);
      }
      // Put a RangeError-throwing value in key5 (survives eviction position)
      // to verify eviction is based on access order
      entries['key5'] = {
        toJSON() {
          throw new RangeError('Invalid string length');
        },
      };

      const cache = new PluginCache(entries, accessOrder);

      // Access key0 to move it to the end (most recently used)
      cache.get('key0');

      cache.writeToDisk(cachePath);

      // After access, order is: [key1..key9, key0]
      // Evict first 5: [key1, key2, key3, key4, key5]
      // Remaining: [key6, key7, key8, key9, key0]
      // key5 (with RangeError) was evicted, so serialization succeeds
      const written = JSON.parse(readFileSync(cachePath, 'utf-8'));
      expect(written.entries['key0']).toBe('value0');
      expect(written.entries['key5']).toBeUndefined();
      expect(written.accessOrder).toEqual([
        'key6',
        'key7',
        'key8',
        'key9',
        'key0',
      ]);
    });
  });

  describe('safeWriteFileCache', () => {
    it('should write data successfully', () => {
      const cachePath = join(tempDir, 'cache.json');
      const content = JSON.stringify({ foo: 'bar' });

      safeWriteFileCache(cachePath, content);

      expect(readFileSync(cachePath, 'utf-8')).toBe(content);
    });

    it('should create parent directories if they do not exist', () => {
      const cachePath = join(tempDir, 'nested', 'dir', 'cache.json');
      const content = JSON.stringify({ foo: 'bar' });

      safeWriteFileCache(cachePath, content);

      expect(readFileSync(cachePath, 'utf-8')).toBe(content);
    });

    it('should not throw on write failure and attempt to remove existing file', () => {
      const dirAsFile = join(tempDir, 'im-a-dir');
      mkdirSync(dirAsFile);

      expect(() => safeWriteFileCache(dirAsFile, 'data')).not.toThrow();
    });
  });
});
