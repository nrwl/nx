import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  existsSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
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
    it('should track access timestamps on get', () => {
      const cache = new PluginCache<string>({ a: '1', b: '2' }, {});
      const before = Date.now();
      const _val = cache.data['a'];
      const after = Date.now();

      const serialized = cache.toSerializable();
      expect(serialized.accessedAt['a']).toBeGreaterThanOrEqual(before);
      expect(serialized.accessedAt['a']).toBeLessThanOrEqual(after);
      // 'b' was not accessed
      expect(serialized.accessedAt['b']).toBeUndefined();
    });

    it('should track access timestamps on set', () => {
      const cache = new PluginCache<string>();
      const before = Date.now();
      cache.data['x'] = 'hello';
      const after = Date.now();

      const serialized = cache.toSerializable();
      expect(serialized.entries['x']).toBe('hello');
      expect(serialized.accessedAt['x']).toBeGreaterThanOrEqual(before);
      expect(serialized.accessedAt['x']).toBeLessThanOrEqual(after);
    });

    it('should clean up accessedAt on delete', () => {
      const cache = new PluginCache<string>({ a: '1' }, { a: 100 });
      delete cache.data['a'];

      const serialized = cache.toSerializable();
      expect(serialized.entries['a']).toBeUndefined();
      expect(serialized.accessedAt['a']).toBeUndefined();
    });

    it('should support Object.keys and in operator', () => {
      const cache = new PluginCache<string>({ a: '1', b: '2' }, {});
      expect(Object.keys(cache.data)).toEqual(['a', 'b']);
      expect('a' in cache.data).toBe(true);
      expect('c' in cache.data).toBe(false);
    });

    it('should evict oldest 50% by accessedAt timestamp', () => {
      const cache = new PluginCache<string>(
        { old1: 'a', old2: 'b', new1: 'c', new2: 'd' },
        { old1: 100, old2: 200, new1: 300, new2: 400 }
      );

      const evicted = cache.evictOldestHalf();
      const serialized = evicted.toSerializable();

      expect(Object.keys(serialized.entries)).toEqual(['new1', 'new2']);
      expect(serialized.entries['new1']).toBe('c');
      expect(serialized.entries['new2']).toBe('d');
      expect(serialized.accessedAt['new1']).toBe(300);
      expect(serialized.accessedAt['new2']).toBe(400);
    });

    it('should treat missing accessedAt as 0 during eviction', () => {
      const cache = new PluginCache<string>(
        { stale: 'a', fresh: 'b' },
        { fresh: 999 }
        // 'stale' has no accessedAt — treated as 0
      );

      const evicted = cache.evictOldestHalf();
      const serialized = evicted.toSerializable();

      expect(Object.keys(serialized.entries)).toEqual(['fresh']);
    });
  });

  describe('readPluginCache', () => {
    it('should read new format with entries and accessedAt', () => {
      const cachePath = join(tempDir, 'cache.json');
      writeFileSync(
        cachePath,
        JSON.stringify({
          entries: { a: '1' },
          accessedAt: { a: 500 },
        })
      );

      const cache = readPluginCache<string>(cachePath);
      expect(cache.data['a']).toBe('1');
    });

    it('should migrate old format (plain Record) with accessedAt = 0', () => {
      const cachePath = join(tempDir, 'old-cache.json');
      writeFileSync(cachePath, JSON.stringify({ a: '1', b: '2' }));

      const cache = readPluginCache<string>(cachePath);
      const serialized = cache.toSerializable();

      expect(serialized.entries['a']).toBe('1');
      expect(serialized.entries['b']).toBe('2');
      expect(serialized.accessedAt['a']).toBe(0);
      expect(serialized.accessedAt['b']).toBe(0);
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
    it('should write cache in new format with entries and accessedAt', () => {
      const cachePath = join(tempDir, 'plugin-cache.json');
      const cache = new PluginCache<string>({ a: '1' }, { a: 100 });

      safeWritePluginCache(cachePath, cache);

      const written = JSON.parse(readFileSync(cachePath, 'utf-8'));
      expect(written.entries).toEqual({ a: '1' });
      expect(written.accessedAt).toEqual({ a: 100 });
    });

    it('should evict oldest 50% on first failure and retry', () => {
      const cachePath = join(tempDir, 'plugin-cache.json');

      const entries: Record<string, any> = {};
      const accessedAt: Record<string, number> = {};
      for (let i = 0; i < 10; i++) {
        entries[`key${i}`] = `value${i}`;
        accessedAt[`key${i}`] = i * 100; // key0=0, key1=100, ..., key9=900
      }
      // Add circular ref in oldest entry to force first write to fail
      const circular: any = { self: null };
      circular.self = circular;
      entries['key0'] = circular;

      const cache = new PluginCache(entries, accessedAt);
      safeWritePluginCache(cachePath, cache);

      // After eviction of oldest 50% (key0-key4), remaining keys should be writable
      const written = JSON.parse(readFileSync(cachePath, 'utf-8'));
      expect(Object.keys(written.entries).length).toBe(5);
      expect(written.entries['key5']).toBe('value5');
      expect(written.entries['key9']).toBe('value9');
      expect(written.entries['key0']).toBeUndefined();
    });

    it('should wipe cache file on total failure', () => {
      const cachePath = join(tempDir, 'plugin-cache.json');
      const entries: Record<string, any> = {};
      const accessedAt: Record<string, number> = {};
      for (let i = 0; i < 4; i++) {
        const circular: any = { self: null };
        circular.self = circular;
        entries[`key${i}`] = circular;
        accessedAt[`key${i}`] = i * 100;
      }

      const cache = new PluginCache(entries, accessedAt);
      safeWritePluginCache(cachePath, cache);

      expect(existsSync(cachePath)).toBe(false);
    });

    it('should write hash file only after successful cache write', () => {
      const cachePath = join(tempDir, 'plugin-cache.json');
      const hashPath = join(tempDir, 'plugin-cache.hash');
      const cache = new PluginCache<string>({ a: '1' }, { a: 100 });

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
      const accessedAt: Record<string, number> = {};
      for (let i = 0; i < 4; i++) {
        const circular: any = { self: null };
        circular.self = circular;
        entries[`key${i}`] = circular;
        accessedAt[`key${i}`] = i;
      }

      const cache = new PluginCache(entries, accessedAt);
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
