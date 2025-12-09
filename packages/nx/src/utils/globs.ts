import { minimatch } from 'minimatch';

export function combineGlobPatterns(...patterns: (string | string[])[]) {
  const p = patterns.flat();
  return p.length > 1 ? '{' + p.join(',') + '}' : p.length === 1 ? p[0] : '';
}

export const GLOB_CHARACTERS = new Set(['*', '|', '{', '}', '(', ')', '[']);

export function isGlobPattern(pattern: string) {
  for (const c of pattern) {
    if (GLOB_CHARACTERS.has(c)) {
      return true;
    }
  }
  return false;
}

/**
 * Cache for compiled minimatch regular expressions.
 * Pre-compiling patterns provides significant performance gains when
 * the same pattern is matched against many strings (e.g., file filtering).
 *
 * Key: pattern string, Value: compiled RegExp
 */
const compiledMinimatchCache = new Map<string, RegExp>();

/**
 * Options key for caching different minimatch configurations
 */
function getPatternCacheKey(pattern: string, dot: boolean): string {
  return dot ? `dot:${pattern}` : pattern;
}

/**
 * Get a compiled RegExp for a minimatch pattern, using cache when available.
 * This eliminates redundant pattern compilation which is expensive.
 *
 * @param pattern - The glob pattern to compile
 * @param options - Minimatch options (currently only 'dot' is supported for caching)
 * @returns Compiled RegExp or null if pattern is invalid
 */
export function getCompiledMinimatchRegex(
  pattern: string,
  options: { dot?: boolean } = {}
): RegExp | null {
  const cacheKey = getPatternCacheKey(pattern, options.dot ?? false);

  let regex = compiledMinimatchCache.get(cacheKey);
  if (regex === undefined) {
    const compiled = minimatch.makeRe(pattern, { dot: options.dot ?? false });
    if (compiled) {
      compiledMinimatchCache.set(cacheKey, compiled);
      regex = compiled;
    } else {
      return null;
    }
  }
  return regex;
}

/**
 * Test if a string matches a glob pattern using cached compiled regex.
 * This is significantly faster than calling minimatch() directly when
 * testing the same pattern against many strings.
 *
 * @param str - The string to test
 * @param pattern - The glob pattern
 * @param options - Minimatch options
 * @returns true if the string matches the pattern
 */
export function minimatchWithCache(
  str: string,
  pattern: string,
  options: { dot?: boolean } = {}
): boolean {
  // Fast path: exact match
  if (str === pattern) {
    return true;
  }

  const regex = getCompiledMinimatchRegex(pattern, options);
  if (!regex) {
    // Invalid pattern - fall back to direct minimatch call
    return minimatch(str, pattern, options);
  }
  return regex.test(str);
}

/**
 * Filter an array of strings using a glob pattern with cached compilation.
 * Much faster than using minimatch() in a filter when dealing with many items.
 *
 * @param items - Array of strings to filter
 * @param pattern - The glob pattern
 * @param options - Minimatch options
 * @returns Filtered array of matching strings
 */
export function filterWithMinimatchCache(
  items: string[],
  pattern: string,
  options: { dot?: boolean } = {}
): string[] {
  const regex = getCompiledMinimatchRegex(pattern, options);
  if (!regex) {
    // Invalid pattern - fall back to direct minimatch
    return items.filter((item) => minimatch(item, pattern, options));
  }
  return items.filter((item) => item === pattern || regex.test(item));
}

/**
 * Create a matcher function for a glob pattern with cached compilation.
 * Useful when you need to test many strings against the same pattern.
 *
 * @param pattern - The glob pattern
 * @param options - Minimatch options
 * @returns A function that tests strings against the pattern
 */
export function createCachedMatcher(
  pattern: string,
  options: { dot?: boolean } = {}
): (str: string) => boolean {
  const regex = getCompiledMinimatchRegex(pattern, options);
  if (!regex) {
    // Invalid pattern - return a function that uses direct minimatch
    return (str: string) => minimatch(str, pattern, options);
  }
  return (str: string) => str === pattern || regex.test(str);
}
