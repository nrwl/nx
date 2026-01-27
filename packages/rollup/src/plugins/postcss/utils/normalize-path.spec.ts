import { normalizePath } from './normalize-path';

describe('normalizePath', () => {
  it('should convert backslashes to forward slashes', () => {
    expect(normalizePath('path\\to\\file.css')).toBe('path/to/file.css');
  });

  it('should handle multiple consecutive backslashes', () => {
    expect(normalizePath('path\\\\to\\\\file.css')).toBe('path/to/file.css');
  });

  it('should return empty string for undefined input', () => {
    expect(normalizePath(undefined)).toBe('');
  });

  it('should return empty string for empty string input', () => {
    expect(normalizePath('')).toBe('');
  });

  it('should not modify paths with only forward slashes', () => {
    expect(normalizePath('path/to/file.css')).toBe('path/to/file.css');
  });

  it('should handle mixed slashes', () => {
    expect(normalizePath('path/to\\file.css')).toBe('path/to/file.css');
  });
});
