import { mkdtempSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { safeWriteCache, safeWritePluginCache } from './plugin-cache-utils';

describe('plugin-cache-utils', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nx-cache-utils-test-'));
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
      // Use a directory path as the cache file path — writing to a directory will fail
      const dirAsFile = join(tempDir, 'im-a-dir');
      mkdirSync(dirAsFile);

      expect(() => safeWriteCache(dirAsFile, 'data')).not.toThrow();
    });
  });

  describe('safeWritePluginCache', () => {
    it('should write hash-map cache successfully', () => {
      const cachePath = join(tempDir, 'plugin-cache.json');
      const data: Record<string, string> = { a: '1', b: '2', c: '3' };

      safeWritePluginCache(cachePath, data);

      const written = JSON.parse(readFileSync(cachePath, 'utf-8'));
      expect(written).toEqual(data);
    });

    it('should evict 50% of entries on first failure and retry', () => {
      const cachePath = join(tempDir, 'plugin-cache.json');
      // Create an object with 4 entries where stringify will fail initially
      // We simulate this by passing an object that has a circular reference
      // that gets resolved after eviction
      const data: Record<string, any> = {};
      for (let i = 0; i < 10; i++) {
        data[`key${i}`] = `value${i}`;
      }
      // Add a circular reference in one of the early keys
      const circular: any = { self: null };
      circular.self = circular;
      data['key0'] = circular;

      safeWritePluginCache(cachePath, data);

      // After eviction of the first 50% (key0-key4), the remaining keys should be writable
      const written = JSON.parse(readFileSync(cachePath, 'utf-8'));
      // The first 5 keys (key0-key4) should have been evicted
      expect(Object.keys(written).length).toBe(5);
      expect(written['key5']).toBe('value5');
      expect(written['key9']).toBe('value9');
      expect(written['key0']).toBeUndefined();
    });

    it('should wipe cache file on total failure (both writes fail)', () => {
      const cachePath = join(tempDir, 'plugin-cache.json');
      // Create data where even after eviction, stringify fails
      const data: Record<string, any> = {};
      for (let i = 0; i < 4; i++) {
        const circular: any = { self: null };
        circular.self = circular;
        data[`key${i}`] = circular;
      }

      safeWritePluginCache(cachePath, data);

      // Cache file should not exist after wipe
      expect(existsSync(cachePath)).toBe(false);
    });

    it('should write hash file only after successful cache write', () => {
      const cachePath = join(tempDir, 'plugin-cache.json');
      const hashPath = join(tempDir, 'plugin-cache.hash');
      const data: Record<string, string> = { a: '1', b: '2' };

      safeWritePluginCache(cachePath, data, {
        hashPath,
        hash: 'abc123',
      });

      expect(readFileSync(cachePath, 'utf-8')).toBe(JSON.stringify(data));
      expect(readFileSync(hashPath, 'utf-8')).toBe('abc123');
    });

    it('should NOT write hash file if cache write fails completely', () => {
      const cachePath = join(tempDir, 'plugin-cache.json');
      const hashPath = join(tempDir, 'plugin-cache.hash');
      // All entries have circular refs — both attempts will fail
      const data: Record<string, any> = {};
      for (let i = 0; i < 4; i++) {
        const circular: any = { self: null };
        circular.self = circular;
        data[`key${i}`] = circular;
      }

      safeWritePluginCache(cachePath, data, {
        hashPath,
        hash: 'abc123',
      });

      expect(existsSync(hashPath)).toBe(false);
    });
  });
});
