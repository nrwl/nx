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
  safeWriteCache,
  safeWritePluginCache,
} from './plugin-cache-utils';

describe('plugin-cache-utils', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nx-cache-utils-test-'));
  });

  describe('PluginCache', () => {
    it('should move key to end of accessOrder on get', () => {
      const cache = new PluginCache<string>({ a: '1', b: '2', c: '3' }, [
        'a',
        'b',
        'c',
      ]);

      let _ = cache.data['a']; // access 'a', moves to end

      const serialized = cache.toSerializable();
      expect(serialized.accessOrder).toEqual(['b', 'c', 'a']);
    });

    it('should add key to end of accessOrder on set', () => {
      const cache = new PluginCache<string>({}, []);
      cache.data['x'] = 'hello';
      cache.data['y'] = 'world';

      const serialized = cache.toSerializable();
      expect(serialized.entries['x']).toBe('hello');
      expect(serialized.entries['y']).toBe('world');
      expect(serialized.accessOrder).toEqual(['x', 'y']);
    });

    it('should move existing key to end on set', () => {
      const cache = new PluginCache<string>({ a: '1', b: '2' }, ['a', 'b']);
      cache.data['a'] = 'updated'; // re-set 'a', moves to end

      const serialized = cache.toSerializable();
      expect(serialized.accessOrder).toEqual(['b', 'a']);
    });

    it('should remove key from accessOrder on delete', () => {
      const cache = new PluginCache<string>({ a: '1', b: '2' }, ['a', 'b']);
      delete cache.data['a'];

      const serialized = cache.toSerializable();
      expect(serialized.entries['a']).toBeUndefined();
      expect(serialized.accessOrder).toEqual(['b']);
    });

    it('should support Object.keys and in operator', () => {
      const cache = new PluginCache<string>({ a: '1', b: '2' }, ['a', 'b']);
      expect(Object.keys(cache.data)).toEqual(['a', 'b']);
      expect('a' in cache.data).toBe(true);
      expect('c' in cache.data).toBe(false);
    });

    it('should evict oldest 50% from front of accessOrder', () => {
      const cache = new PluginCache<string>(
        { old1: 'a', old2: 'b', new1: 'c', new2: 'd' },
        ['old1', 'old2', 'new1', 'new2']
      );

      const evicted = cache.evictOldestHalf();
      const serialized = evicted.toSerializable();

      expect(serialized.accessOrder).toEqual(['new1', 'new2']);
      expect(serialized.entries).toEqual({ new1: 'c', new2: 'd' });
    });

    it('should evict majority when odd count', () => {
      const cache = new PluginCache<string>({ a: '1', b: '2', c: '3' }, [
        'a',
        'b',
        'c',
      ]);

      const evicted = cache.evictOldestHalf();
      const serialized = evicted.toSerializable();

      // ceil(3/2) = 2 evicted, 1 remains
      expect(serialized.accessOrder).toEqual(['c']);
      expect(serialized.entries).toEqual({ c: '3' });
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
      expect(cache.data['a']).toBe('1');
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
      expect(Object.keys(cache.data)).toHaveLength(0);
    });

    it('should return empty cache if file is corrupted', () => {
      const cachePath = join(tempDir, 'bad.json');
      writeFileSync(cachePath, 'not json!!!');

      const cache = readPluginCache<string>(cachePath);
      expect(Object.keys(cache.data)).toHaveLength(0);
    });
  });

  describe('safeWritePluginCache', () => {
    it('should write cache with entries and accessOrder', () => {
      const cachePath = join(tempDir, 'plugin-cache.json');
      const cache = new PluginCache<string>({ a: '1' }, ['a']);

      safeWritePluginCache(cachePath, cache);

      const written = JSON.parse(readFileSync(cachePath, 'utf-8'));
      expect(written.entries).toEqual({ a: '1' });
      expect(written.accessOrder).toEqual(['a']);
    });

    it('should evict oldest 50% on first failure and retry', () => {
      const cachePath = join(tempDir, 'plugin-cache.json');

      const entries: Record<string, any> = {};
      const accessOrder: string[] = [];
      for (let i = 0; i < 10; i++) {
        entries[`key${i}`] = `value${i}`;
        accessOrder.push(`key${i}`);
      }
      // Add circular ref in oldest entry to force first write to fail
      const circular: any = { self: null };
      circular.self = circular;
      entries['key0'] = circular;

      const cache = new PluginCache(entries, accessOrder);
      safeWritePluginCache(cachePath, cache);

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

    it('should wipe cache file on total failure', () => {
      const cachePath = join(tempDir, 'plugin-cache.json');
      const entries: Record<string, any> = {};
      const accessOrder: string[] = [];
      for (let i = 0; i < 4; i++) {
        const circular: any = { self: null };
        circular.self = circular;
        entries[`key${i}`] = circular;
        accessOrder.push(`key${i}`);
      }

      const cache = new PluginCache(entries, accessOrder);
      safeWritePluginCache(cachePath, cache);

      expect(existsSync(cachePath)).toBe(false);
    });

    it('should write hash file only after successful cache write', () => {
      const cachePath = join(tempDir, 'plugin-cache.json');
      const hashPath = join(tempDir, 'plugin-cache.hash');
      const cache = new PluginCache<string>({ a: '1' }, ['a']);

      safeWritePluginCache(cachePath, cache, {
        hashPath,
        hash: 'abc123',
      });

      expect(readFileSync(hashPath, 'utf-8')).toBe('abc123');
    });

    it('should NOT write hash file if cache write fails completely', () => {
      const cachePath = join(tempDir, 'plugin-cache.json');
      const hashPath = join(tempDir, 'plugin-cache.hash');

      const entries: Record<string, any> = {};
      const accessOrder: string[] = [];
      for (let i = 0; i < 4; i++) {
        const circular: any = { self: null };
        circular.self = circular;
        entries[`key${i}`] = circular;
        accessOrder.push(`key${i}`);
      }

      const cache = new PluginCache(entries, accessOrder);
      safeWritePluginCache(cachePath, cache, {
        hashPath,
        hash: 'abc123',
      });

      expect(existsSync(hashPath)).toBe(false);
    });
  });

  describe('safeWriteCache', () => {
    it('should write data successfully', () => {
      const cachePath = join(tempDir, 'cache.json');
      const content = JSON.stringify({ foo: 'bar' });

      safeWriteCache(cachePath, content);

      expect(readFileSync(cachePath, 'utf-8')).toBe(content);
    });

    it('should create parent directories if they do not exist', () => {
      const cachePath = join(tempDir, 'nested', 'dir', 'cache.json');
      const content = JSON.stringify({ foo: 'bar' });

      safeWriteCache(cachePath, content);

      expect(readFileSync(cachePath, 'utf-8')).toBe(content);
    });

    it('should not throw on write failure and attempt to remove existing file', () => {
      const dirAsFile = join(tempDir, 'im-a-dir');
      mkdirSync(dirAsFile);

      expect(() => safeWriteCache(dirAsFile, 'data')).not.toThrow();
    });
  });
});
