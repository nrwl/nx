import { parseMaxCacheSize } from './cache';

describe('cache', () => {
  describe('parseMaxCacheSize', () => {
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
});
