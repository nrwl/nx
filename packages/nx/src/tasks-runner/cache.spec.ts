import {
  formatCacheSize,
  parseMaxCacheSize,
  remoteCacheWritesDisabled,
} from './cache';
import { withEnvironmentVariables } from '../internal-testing-utils/with-environment';

describe('cache', () => {
  describe('parseMaxCacheSize', () => {
    it('should support numerical byte values', () => {
      expect(parseMaxCacheSize('0')).toEqual(0);
      expect(parseMaxCacheSize(0)).toEqual(0);
      expect(parseMaxCacheSize('1')).toEqual(1);
      expect(parseMaxCacheSize(1024)).toEqual(1024);
    });

    it('should parse KB', () => {
      expect(parseMaxCacheSize('1KB')).toEqual(1024);
    });

    it('should parse MB', () => {
      expect(parseMaxCacheSize('1MB')).toEqual(1024 * 1024);
    });

    it('should parse GB', () => {
      expect(parseMaxCacheSize('1GB')).toEqual(1024 * 1024 * 1024);
    });

    it('should parse B', () => {
      expect(parseMaxCacheSize('1B')).toEqual(1);
    });

    it('should parse as bytes by default', () => {
      expect(parseMaxCacheSize('1')).toEqual(1);
    });

    it('should handle decimals', () => {
      expect(parseMaxCacheSize('1.5KB')).toEqual(1024 * 1.5);
    });

    it('should error if invalid unit', () => {
      expect(() => parseMaxCacheSize('1ZB')).toThrow();
    });

    it('should error if invalid number', () => {
      expect(() => parseMaxCacheSize('abc')).toThrow();
    });

    it('should error if multiple decimal points', () => {
      expect(() => parseMaxCacheSize('1.5.5KB')).toThrow;
    });
  });

  describe('formatCacheSize', () => {
    it('should format bytes', () => {
      expect(formatCacheSize(1)).toEqual('1.00 B');
    });

    it('should format KB', () => {
      expect(formatCacheSize(1024)).toEqual('1.00 KB');
    });

    it('should format MB', () => {
      expect(formatCacheSize(1024 * 1024)).toEqual('1.00 MB');
    });

    it('should format GB', () => {
      expect(formatCacheSize(1024 * 1024 * 1024)).toEqual('1.00 GB');
    });

    it('should format partial units', () => {
      expect(formatCacheSize(1024 * 88.5)).toEqual('88.50 KB');
    });
  });

  describe('remoteCacheWritesDisabled', () => {
    const withEnv = (value: string | false, options = {}) =>
      withEnvironmentVariables({ NX_DISABLE_REMOTE_CACHE_WRITES: value }, () =>
        remoteCacheWritesDisabled(options)
      );

    it('should default to enabled writes when unset', () => {
      expect(withEnv(false)).toBe(false);
    });

    it('should disable writes when set to true', () => {
      expect(withEnv('true')).toBe(true);
    });

    it('should only accept the exact string "true"', () => {
      // Matches how NX_DISABLE_REMOTE_CACHE is read, so `=1` or `=TRUE` does
      // not silently half-enable the flag.
      expect(withEnv('false')).toBe(false);
      expect(withEnv('1')).toBe(false);
      expect(withEnv('TRUE')).toBe(false);
    });

    it('should disable writes via the option without the env var', () => {
      expect(withEnv(false, { skipRemoteCacheWrites: true })).toBe(true);
    });

    it('should let the env var disable writes when the option is false', () => {
      expect(withEnv('true', { skipRemoteCacheWrites: false })).toBe(true);
    });
  });
});
