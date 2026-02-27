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
  safeWritePluginCache,
} from './plugin-cache-utils';

describe('plugin-cache-utils', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nx-cache-utils-test-'));
  });

  describe('PluginCache', () => {
    it('should return value on get and track access', () => {
      const cache = new PluginCache<string>({ a: '1', b: '2' }, ['a', 'b']);
      expect(cache.get('a')).toBe('1');
      expect(cache.get('missing')).toBeUndefined();
    });

    it('should store value on set and track access', () => {
      const cache = new PluginCache<string>({}, []);
      cache.set('x', 'hello');
      expect(cache.get('x')).toBe('hello');
    });

    it('should check existence with has without tracking', () => {
      const cache = new PluginCache<string>({ a: '1' }, ['a']);
      expect(cache.has('a')).toBe(true);
      expect(cache.has('z')).toBe(false);
    });

    it('should move accessed keys to end of access order', () => {
      const cache = new PluginCache<string>({ a: '1', b: '2', c: '3' }, [
        'a',
        'b',
        'c',
      ]);
      cache.get('a'); // access oldest key

      const serialized = cache.toSerializable();
      // 'a' should move to end, b and c stay in front
      expect(serialized.accessOrder).toEqual(['b', 'c', 'a']);
    });

    it('should put set keys at end of access order', () => {
      const cache = new PluginCache<string>({ a: '1', b: '2' }, ['a', 'b']);
      cache.set('c', '3');

      const serialized = cache.toSerializable();
      expect(serialized.accessOrder).toEqual(['a', 'b', 'c']);
      expect(serialized.entries['c']).toBe('3');
    });

    it('should dedupe session log keeping last occurrence', () => {
      const cache = new PluginCache<string>({ a: '1', b: '2' }, ['a', 'b']);
      cache.get('a');
      cache.get('b');
      cache.get('a'); // a is most recent now

      const serialized = cache.toSerializable();
      expect(serialized.accessOrder).toEqual(['b', 'a']);
    });

    it('should cap entries at maxEntries, dropping oldest', () => {
      const entries: Record<string, string> = {};
      const order: string[] = [];
      for (let i = 0; i < 10; i++) {
        entries[`key${i}`] = `val${i}`;
        order.push(`key${i}`);
      }
      const cache = new PluginCache<string>(entries, order);

      const serialized = cache.toSerializable(5);
      expect(Object.keys(serialized.entries)).toHaveLength(5);
      // Should keep the last 5 (most recent by order)
      expect(serialized.entries['key5']).toBe('val5');
      expect(serialized.entries['key9']).toBe('val9');
      expect(serialized.entries['key0']).toBeUndefined();
      expect(serialized.accessOrder).toEqual([
        'key5',
        'key6',
        'key7',
        'key8',
        'key9',
      ]);
    });

    it('should not cap when under maxEntries', () => {
      const cache = new PluginCache<string>({ a: '1', b: '2' }, ['a', 'b']);
      const serialized = cache.toSerializable(500);
      expect(Object.keys(serialized.entries)).toHaveLength(2);
    });

    it('should handle new keys not in original accessOrder', () => {
      const cache = new PluginCache<string>({ a: '1' }, []);
      // 'a' exists but has no prior access order entry
      const serialized = cache.toSerializable();
      expect(serialized.accessOrder).toContain('a');
    });

    it('should prioritize accessed keys over unaccessed when capping', () => {
      const cache = new PluginCache<string>({ old: 'x', fresh: 'y' }, [
        'old',
        'fresh',
      ]);
      cache.get('fresh'); // mark as recently accessed

      const serialized = cache.toSerializable(1);
      // Should keep 'fresh' (accessed) over 'old' (not accessed this session)
      expect(serialized.entries['fresh']).toBe('y');
      expect(serialized.entries['old']).toBeUndefined();
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
      expect(cache.get('b')).toBe('2');
    });

    it('should migrate legacy plain Record format', () => {
      const cachePath = join(tempDir, 'legacy.json');
      writeFileSync(cachePath, JSON.stringify({ a: '1', b: '2' }));

      const cache = readPluginCache<string>(cachePath);
      expect(cache.get('a')).toBe('1');
      expect(cache.get('b')).toBe('2');
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

    it('should return empty cache when NX_CACHE_PROJECT_GRAPH is false', () => {
      const cachePath = join(tempDir, 'cache.json');
      writeFileSync(
        cachePath,
        JSON.stringify({ entries: { a: '1' }, accessOrder: ['a'] })
      );

      const origEnv = process.env.NX_CACHE_PROJECT_GRAPH;
      process.env.NX_CACHE_PROJECT_GRAPH = 'false';
      try {
        const cache = readPluginCache<string>(cachePath);
        expect(cache.has('a')).toBe(false);
      } finally {
        if (origEnv === undefined) {
          delete process.env.NX_CACHE_PROJECT_GRAPH;
        } else {
          process.env.NX_CACHE_PROJECT_GRAPH = origEnv;
        }
      }
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

    it('should cap entries when maxEntries is set', () => {
      const cachePath = join(tempDir, 'plugin-cache.json');
      const entries: Record<string, string> = {};
      const order: string[] = [];
      for (let i = 0; i < 10; i++) {
        entries[`key${i}`] = `val${i}`;
        order.push(`key${i}`);
      }
      const cache = new PluginCache<string>(entries, order);

      safeWritePluginCache(cachePath, cache, { maxEntries: 3 });

      const written = JSON.parse(readFileSync(cachePath, 'utf-8'));
      expect(Object.keys(written.entries)).toHaveLength(3);
      expect(written.entries['key7']).toBe('val7');
      expect(written.entries['key9']).toBe('val9');
    });

    it('should not throw on write failure', () => {
      const dirAsFile = join(tempDir, 'im-a-dir');
      mkdirSync(dirAsFile);
      const cache = new PluginCache<string>({ a: '1' }, ['a']);

      // Writing to a directory path should fail but not throw
      expect(() => safeWritePluginCache(dirAsFile, cache)).not.toThrow();
    });

    it('should write hash file after successful cache write', () => {
      const cachePath = join(tempDir, 'plugin-cache.json');
      const hashPath = join(tempDir, 'plugin-cache.hash');
      const cache = new PluginCache<string>({ a: '1' }, ['a']);

      safeWritePluginCache(cachePath, cache, {
        hashPath,
        hash: 'abc123',
      });

      expect(readFileSync(hashPath, 'utf-8')).toBe('abc123');
    });

    it('should NOT write hash file if cache write fails', () => {
      const dirAsFile = join(tempDir, 'im-a-dir');
      mkdirSync(dirAsFile);
      const hashPath = join(tempDir, 'plugin-cache.hash');
      const cache = new PluginCache<string>({ a: '1' }, ['a']);

      safeWritePluginCache(dirAsFile, cache, {
        hashPath,
        hash: 'abc123',
      });

      expect(existsSync(hashPath)).toBe(false);
    });
  });

  describe('safeWriteFileCache', () => {
    it('should write data successfully', () => {
      const cachePath = join(tempDir, 'cache.json');
      safeWriteFileCache(cachePath, JSON.stringify({ foo: 'bar' }));

      expect(JSON.parse(readFileSync(cachePath, 'utf-8'))).toEqual({
        foo: 'bar',
      });
    });

    it('should create parent directories', () => {
      const cachePath = join(tempDir, 'nested', 'dir', 'cache.json');
      safeWriteFileCache(cachePath, 'data');

      expect(readFileSync(cachePath, 'utf-8')).toBe('data');
    });

    it('should not throw on write failure', () => {
      const dirAsFile = join(tempDir, 'im-a-dir');
      mkdirSync(dirAsFile);

      expect(() => safeWriteFileCache(dirAsFile, 'data')).not.toThrow();
    });
  });
});
